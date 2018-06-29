const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');

fs.readFile('./weapon-upgrades.json', 'utf8', function (err, data) {
  if (err) throw err;
  let weaponList = JSON.parse(data);

  let upgradePhrases = _.uniq(_.flatten(weaponList.map(weapon => {
    return _.compact(_.keys(weapon.upgrades), ', ');
  })));

  const result = upgradePhrases.reduce((acc, current) => {
    acc[current] = '';
    return acc;
  }, {});

  console.log('upgrade items in jp: ', result);
  fs.outputFile('./translations/base/weapon-upgrades.json', JSON.stringify(result, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('phrases done');
});
