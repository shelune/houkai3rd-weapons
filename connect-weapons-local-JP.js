const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const _ = require('lodash');

const readFile = util.promisify(fs.readFile);
const sourceFiles = {
  jp: './fetched/weapon-list-JP.json',
  sea: './fetched/weapon-list-SEA.json',
  global: './fetched/weapon-list-local.json',
  nameTranslations: './translations/translated/weapon-names.json'
}

const globalNames = './translations/translated/weapon-names.json';

let getFile = (fileName) => {
  return readFile(fileName, 'utf8').then(file => {
    return JSON.parse(file);
  }).catch(err => {
    console.log('error when getting weapons', err);
  })
}

let updateGlobalNames = async () => {
  let weaponListJP = await getFile(sourceFiles.jp);
  let nameTranslations = await getFile(globalNames);
  let weaponListWithGlobalNames = weaponListJP.map(weapon => {
    let source = _.find(nameTranslations, (obj) => {return obj.url === weapon.url});
    if (!!source && source.name === '核心収束砲Delta') {
      console.log('source: ', source);
    }
    if (!!source) {
      weapon.name = source.nameProposal;
      weapon.nameJP = source.name;
      delete weapon.nameProposal;
    }
    
    return weapon;
  });
  return weaponListWithGlobalNames;
}

let updateDescription = async (weaponList) => {
  let weaponListGlobal = await getFile(sourceFiles.global);
  let weaponListWithDescriptions = weaponList.map(weapon => {
    let target = {...weapon, description: ''};
    let source = _.find(weaponListGlobal, weaponGlobal => {
      return _.includes(target.name, weaponGlobal.name);
    });
    target.description = source ? source.description : '';
    return target;
  });
  return weaponListWithDescriptions;
}

let formatStats = (weaponList) => {
  const statsToConvert = ['atk', 'crit', 'load', 'rank'];
  return weaponList.map(weapon => {
    statsToConvert.forEach(stat => {
      weapon[stat] = parseInt(weapon[stat]);
    });
    return weapon;
  });
}

let formatProperties = (weaponList) => {
  return weaponList.map(weapon => {
    const {
      name, category, rank, 
      atk, crit, load,
      active, passive,
      debuffs, elements,
      description,
      upgradeReq, upgrades,
      url, thumbnail, nameJP
    } = weapon;
    return {
      name, category, rank,
      atk, crit, load,
      active: active,
      passive: passive,
      debuffs, elements,
      description,
      upgradeReq, upgrades,
      referenceUrl: url,
      thumbnail,
      nameJP
    };
  });
}

let formatUpgrades = (weaponList) => {
  return weaponList.map(weapon => {
    let target = {...weapon};
    target.upgradeReq = [];
    let upgradeItems = _.keys(target.upgrades);
    let upgradeCount = target.upgrades[_.last(upgradeItems)] ? target.upgrades[_.last(upgradeItems)].requirement : [];
    for (let i = 0; i < upgradeCount.length; i++) {
      target.upgradeReq.push(
        {
          ['count']: i,
          ['materials']: upgradeItems.map(item => {
            return {
              name: item,
              img: target.upgrades[item].img,
              count: isNaN(target.upgrades[item].requirement[i] * 1) ? 0 : parseInt(target.upgrades[item].requirement[i]),
            }
        })
      });
    }
    return target;
  });
}

updateGlobalNames().then(async weaponList => {
  console.log('global named weapon list: ', weaponList);
  let weaponListWithDescriptions = await updateDescription(weaponList);
  let weaponFormatted = formatUpgrades(formatStats(weaponListWithDescriptions));
  let result = formatProperties(weaponFormatted)
  fs.outputFile('./generated/weapon-list-global.json', JSON.stringify(result, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('WRITING DONE', weaponFormatted);
})