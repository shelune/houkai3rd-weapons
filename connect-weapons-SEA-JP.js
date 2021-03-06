const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const _ = require('lodash');

const readFile = util.promisify(fs.readFile);
const sourceFiles = {
  jp: './fetched/weapon-list-JP.json',
  sea: './fetched/weapon-list-SEA.json',
  global: './fetched/weapon-list-local.json'
}

let getWeapons = (fileName) => {
  return readFile(fileName, 'utf8').then(file => {
    return JSON.parse(file);
  }).catch(err => {
    console.log('error when getting weapons', err);
  })
}

let connectFiles = async () => {
  let weaponListSEA = await getWeapons(sourceFiles.sea);
  let weaponListJP = await getWeapons(sourceFiles.jp);
  const keysToConnect = ['active', 'passive', 'debuffs', 'elements'];
  let connectedWeapons = weaponListJP.map(weaponJP => {
    weaponListSEA.forEach(weaponSEA => {
      if (_.includes(weaponSEA.nameJP, weaponJP.name)) {
        keysToConnect.forEach(key => {
          weaponJP[key] = weaponSEA[key];
          weaponJP.nameProposal = weaponSEA.name;
        });
      } else if (weaponJP.atk === weaponSEA.atk && weaponJP.crit === weaponSEA.crit && weaponJP.category === weaponSEA.category && weaponJP.rank === weaponSEA.rank) {
        keysToConnect.forEach(key => {
          weaponJP[key] = weaponSEA[key];
          weaponJP.nameProposal = weaponSEA.name;
        });
      }
    });
    return weaponJP;
  });

  console.log('weapon list after connecting:', connectedWeapons);
  return connectedWeapons;
}

connectFiles().then((weaponList) => {
  fs.outputFile('./fetched/weapon-list-JP.json', JSON.stringify(weaponList, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });

  const nameEntries = weaponList.map(weapon => {
    return {
      name: weapon.name,
      namedProposal: weapon.nameProposal || '',
      url: weapon.url
    };
  });

  fs.outputFile('./translations/base/weapon-names.json', JSON.stringify(nameEntries, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('WRITING DONE');
});