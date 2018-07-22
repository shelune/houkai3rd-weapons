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
      let name = $(row).find('td:first-child a').text();
      let url = $(row).find('td:first-child a').attr('href');
      let rank = $(row).find('td:nth-child(2)').text().match(/\d/i) ? $(row).find('td:nth-child(2)').text().match(/\d/i)[0] : '';
      let atk = $(row).find('td:nth-child(3)').text();
      let category = getWeaponCategory($(row).attr('class'));
      let thumbnail = $(row).find('td:first-child a img').attr('src');

      return {url, thumbnail, name, rank, atk, category, description: ''};
    });

    console.log('weapons urls: ', weapons);
    return weapons;
  } catch (err) {
    console.log('error when getting page content: ', err);
  }
}

let getWeaponCategory = weapon => {
  const weaponCategory = {
    'gan': 'dual-gun',
    'juho': 'cannon',
    'tachi': 'katana',
    'taiken': 'greatsword',
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
      const { load, crit, upgrades } = await getExtraInfo(weapon.url);
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

let getExtraInfo = async (url) => {
  let upgrades = {};
  let crit = '', load = '', name = '';
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let upgradeRows = Array.from($('.hk_sozai table tr')).slice(1);

    const statTable = $(Array.from($('.hk3_buki'))[1]).find('table');
    const statCellPos = {
      atk: findStatCell($, statTable, '攻撃'),
      crit: findStatCell($, statTable, '会心'),
      load: findStatCell($, statTable, 'コスト')
    };
    crit = statTable.find(`tr td`).eq(statCellPos.crit).text() || '0';
    load = statTable.find('tr td:last-child').text() || '0';

    const upgradeCount = $(upgradeRows[0]).find('td').length - 1;
    
    upgradeRows.forEach((row, index) => {
      const upgradeName = $(row).find('td:first-child a').text();
      const upgradeImg = $(row).find('td:first-child img').attr('src');
      upgrades[upgradeName] = {
        requirement: Array.from($(row).find('td:not(:first-child)')).map((cell, upgradeTime) => {
          return !$(cell).text().match(/\d+/i) ? '?' : $(cell).text().match(/\d/i)[0];
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
};

let findStatCell = ($, source, stat) => {
  const statHeaders = Array.from(source.find('tr:first-child th'));
  const statCell = statHeaders.filter(header => {
    return $(header).text().trim() === stat;
  })[0];
  const index = $(statCell).index();
  return index;
};

let getUpgradeTranslations = (weaponList) => {
  return readFile('./translations/translated/weapon-upgrades.json', 'utf8')
  .then(file => {
    let translation = JSON.parse(file);
    return weaponList.map(weapon => {
      let translatedWeapon = {...weapon};
      for (let key in translation) {
        if (weapon.upgrades.hasOwnProperty(key)) {
          translatedWeapon.upgrades[translation[key]] = weapon.upgrades[key];
          delete weapon.upgrades[key];
        }
      }
      return translatedWeapon;
    })
  })
  .catch(err => {
    console.log('error in replacing translation keys');
  })
}

// just check if any weapon has same stats
let getUniqueWeaponList = (weaponList) => {
  const compactWeaponListUniq = _.uniqBy(weaponList, (weapon) => {
    return [weapon.atk, weapon.crit, weapon.category, weapon.rank].join();
  });

  const duplicatedWeaponValues = _.difference(weaponList, compactWeaponListUniq);
  fs.outputFile('./fetched/weapon-duplicates-specs-JP.json', JSON.stringify(duplicatedWeaponValues, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  //console.log('COMPACT: ', weaponList.length);
  //console.log('COMPACT UNIQ: ', compactWeaponListUniq.length);
  return compactWeaponListUniq;
}

getWeaponUrls(urlSource).then(async weaponList => {
  const weaponsWithUpgrades = await getUpgradesList(weaponList);
  fs.outputFile('./fetched/weapon-list-JP-RAW.json', JSON.stringify(weaponsWithUpgrades, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('writing raw jp weapons: ', weaponsWithUpgrades.length);
  const weaponsWithTranslatedUpgrades = await getUpgradeTranslations(weaponsWithUpgrades);
  fs.outputFile('./fetched/weapon-list-JP-with-dupls.json', JSON.stringify(weaponsWithTranslatedUpgrades, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('writing translated upgrades weapons: ', weaponsWithTranslatedUpgrades.length);

  const result = getUniqueWeaponList(weaponsWithTranslatedUpgrades);
  
  // console.log('writing: ', weaponsWithTranslatedUpgrades);
  fs.outputFile('./fetched/weapon-list-JP.json', JSON.stringify(result, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });

  console.log('writing unique-stats weapons: ', result.length);
});