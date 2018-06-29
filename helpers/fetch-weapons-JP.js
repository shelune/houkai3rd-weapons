const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const _ = require('lodash');
const axios = require('axios');
const cheerio = require('cheerio');

const readFile = util.promisify(fs.readFile);

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
      let category = getWeaponCategory($(row).attr('class'));

      return {url, rank, atk, category};
    });

    console.log('weapons urls: ', weapons);
    return weapons;
  } catch (err) {
    console.log('error when getting page content: ', err);
  }
}

let getWeaponCategory = weapon => {
  const weaponCategory = {
    'gan': 'pistol',
    'juho': 'cannon',
    'tachi': 'katana',
    'taiken': 'claymore',
    'jyuji': 'cross',
    'wanko': 'gauntlet'
  };

  for (let key in weaponCategory) {
    if (weapon.indexOf(key) != -1) {
      return weaponCategory[key];
    }
  }
};

let getUpgradesList = async (weaponList) => {
  try {
    const weaponListWithUpgrades = await Promise.all(weaponList.map(async weapon => {
      const { load, crit, upgrades } = await getUpgradeItems(weapon.url);
      return {
        ...weapon,
        load,
        crit,
        upgrades,
      };
    }));

    console.log('fetching done!', weaponListWithUpgrades);
    return weaponListWithUpgrades;
  } catch (err) {
    console.log('error when adding upgrade items to weapon:', err);
  }
}

let getUpgradeItems = async (url) => {
  let upgrades = {};
  let crit = '';
  let load = '';
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let upgradeRows = Array.from($('.hk_sozai table tbody tr')).slice(1);
    crit = $(Array.from($('.hk3_buki'))[1]).find('table tbody tr td:nth-child(2)').text() || '';
    load = $(Array.from($('.hk3_buki'))[1]).find('table tbody tr td:last-child').text() || '';

    const upgradeCount = $(upgradeRows[0]).find('td').length - 1;
    
    upgradeRows.forEach((row, index) => {
      const upgradeName = $(row).find('td:first-child a').text();
      const upgradeImg = $(row).find('td:first-child img').attr('src');
      upgrades[upgradeName] = {
        requirement: Array.from($(row).find('td:not(:first-child)')).map((cell, upgradeTime) => {
          return {[`upgrade_${upgradeTime + 1}`]: !$(cell).text().match(/\d+/i) ? '?' : $(cell).text().match(/\d/i)[0]};
        }),
        img: upgradeImg
      };
    });
    // console.log('weapon upgrades: ', upgrades);
    const result = {load, crit, upgrades};
    return result;
  } catch (err) {
    console.log('getting upgrades but failed: ', err);
  }
}

let getUpgradeTranslations = (weaponList) => {
  return readFile('./translations/translated/weapon-upgrades.json', 'utf8').then(file => {
    let translation = JSON.parse(file);
    return weaponList.map(weapon => {
      let translatedWeapon = {...weapon};
      for (let key in translation) {
        for (let upgradeKey in weapon.upgrades) {
          if (upgradeKey == key) {
            translatedWeapon.upgrades[translation[key]] = weapon.upgrades[upgradeKey];
            delete weapon.upgrades[upgradeKey];
          }
        }
      }
      return translatedWeapon;
    })
  })
}

// just check if any weapon has same stats
let checkDuplicateStats = (weaponList) => {
  const keysToCheck = ['atk', 'crit', 'category', 'rank'];
  const compactWeaponList = weaponList.map(weapon => {
    const { atk, crit, category, rank } = weapon;
    return {
      atk,
      crit,
      ca
    }
  })
  return weaponList.some(weapon => {
    
  })
}

getWeaponUrls(urlSource).then(async weaponList => {
  const weaponsWithUpgrades = await getUpgradesList(weaponList);
  const weaponsWithTranslatedUpgrades = await getUpgradeTranslations(weaponsWithUpgrades);
  
  // console.log('writing: ', weaponsWithTranslatedUpgrades);
  fs.outputFile('./fetched/weapon-list-JP.json', JSON.stringify(weaponsWithTranslatedUpgrades, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });

  console.log('WRITE DONE!');
});