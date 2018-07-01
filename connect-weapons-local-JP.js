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
    weapon.nameProposal = source.nameProposal;
    return weapon;
  });
  return weaponListWithGlobalNames;
}

let updateDescription = async (weaponList) => {
  let weaponListGlobal = await getFile(sourceFiles.global);
  let weaponListWithDescriptions = weaponList.map(weapon => {
    let target = {...weapon, description: ''};
    let source = _.find(weaponListGlobal, weaponGlobal => {
      return _.includes(target.nameProposal, weaponGlobal.name);
    });
    target.description = source ? source.description || '' : '';
    return target;
  });
  return weaponListWithDescriptions;
}

updateGlobalNames().then(async weaponList => {
  let weaponListWithDescriptions = await updateDescription(weaponList);
  fs.outputFile('./generated/weapon-list-global.json', JSON.stringify(weaponListWithDescriptions, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('WRITING DONE', weaponListWithDescriptions);
})