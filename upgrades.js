const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const axios = require('axios');
const cheerio = require('cheerio');

// weapon list
const urlSource = 'https://houkai3rd.gamewith.jp/article/show/48936';

let getWeaponUrls = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let weapons = [];
    let weaponRows = Array.from($('#result table tbody tr')).slice(1);

    console.log('weapon count: ', weaponRows.length);

    return weaponRows.map(row => {
      let url = $(row).find('td:first-child a').attr('href');
      let rank = $(row).find('td:nth-child(2)').text().match(/\d/i) ? $(row).find('td:nth-child(2)').text().match(/\d/i)[0] : '';
      let atk = $(row).find('td:nth-child(3)').text();

      return {url, rank, atk};
    });

    console.log('weapons urls: ', weapons);
    return weapons;
  } catch (err) {
    console.log('error when getting page content: ', err);
  }
}

let getUpgradesList = async (weaponList) => {
  const weaponListWithUpgrades = await Promise.all(weaponList.map(async weapon => {
    return {
      upgrades: await getUpgradeItems(weapon.url),
      ...weapon
    };
  }));
  
  console.log('fetching done!', weaponListWithUpgrades);
  return weaponListWithUpgrades;
}

let getUpgradeItems = async (url) => {
  let upgrades = {};
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let upgradeRows = Array.from($('.hk_sozai table tbody tr')).slice(1);

    const upgradeCount = $(upgradeRows[0]).find('td').length - 1;
    
    upgradeRows.forEach((row, index) => {
      const upgradeName = $(row).find('td:first-child a').text();
      const upgradeImg = $(row).find('td:first-child img').attr('src');
      upgrades[upgradeName] = {
        requirement: Array.from($(row).find('td:not(:first-child)')).map((cell, upgradeTime) => {
          return {[`upgrade_${upgradeTime + 1}`]: $(cell).text() === '-' ? '0' : $(cell).text()};
        }),
        img: upgradeImg
      };
    });
    console.log('weapon upgrades: ', upgrades);

    return upgrades;
  } catch (err) {
    console.log('getting upgrades but failed: ', err);
  }
}

getWeaponUrls(urlSource).then(async weaponList => {
  const weaponsWithUpgrades = await getUpgradesList(weaponList);
  console.log('writing: ', weaponsWithUpgrades);

  fs.writeFile('weapon-upgrades.json', JSON.stringify(weaponsWithUpgrades, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });

  console.log('WRITE DONE!');
});