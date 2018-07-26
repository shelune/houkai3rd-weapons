const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient({
  keyFilename: './google-vision-key.json'  
});

const fileSource = './images/houkai-weps-upgraded-gb/';

// run Google Vision to get weapon data
fs.readdir(fileSource, (err, files) => {
  let results = [];
  let weaponData = [];
  files.forEach(file => {
    client
    .documentTextDetection(fileSource + file)
    .then(results => {
      const detections = results[0].fullTextAnnotation;
      // console.log('detections:', detections);

      const blocks = _.flattenDeep(detections.pages.map(page => {
        return page.blocks.map(block => {
          return block.paragraphs.map(paragraph => {
            return _.join(paragraph.words.map(word => {
              return _.join(word.symbols.map(symbol => {
                return symbol.text;
              }), '');
            }), ' ');
          });
        });
      }));
      
      // console.log('blocks: ', blocks);

      const weapon = {};
      weapon[file] = formatSource(_.uniq(blocks));
      return weapon;
    })
    .then(weapon => {
      results.push(weapon);
      const parsedWeapon = parseInfo(weapon);
      weaponData.push(parsedWeapon);

      try {
        fs.renameSync(fileSource + file, fileSource + parsedWeapon.name + '.png');
      } catch (err) {
        console.log('error when renaming files', err);
      }
    })
    .catch(err => {
      console.error('ERROR when ocr: ', err);
    })
    .then(() => {
      fs.outputFile('./fetched/weapon-list-local-RAW.json', JSON.stringify(results, null, 4), (err) => {
        if (err) {
          console.log('error when writing file out: ', err)
        }
      });
      fs.outputFile('./fetched/weapon-list-local.json', JSON.stringify(weaponData, null, 4), (err) => {
        if (err) {
          console.log('error when writing file out: ', err)
        }
      });
      console.log('DONE!');
    });
  });
});

// format fetched json and remove excessive texts
const formatSource = (source) => {
  const noiseList = [
    'Obtain',
    '*',
    'Applicable Char',
    'Back',
    'Menu',
    'WEAPON'
  ];
  let coreData = source.filter(text => {
    return !noiseList.some(noise => _.includes(text, noise))
  });
  
  let formatted = coreData.map(text => {
    return text.replace(' . ', '. ').replace(' - ', '-').replace(" ' ", "'").replace('[ ', '[').replace(' ]', ']').replace(' : ', ': ');
  });
  
  return formatted;
}

// parse weapon specs
const parseInfo = (source) => {
  let weapon = {};
  for (let key in source) {
    source[key].forEach((text, index) => {
      if (text === 'ATK') {
        let nameString = source[key][index - 1];
        if (nameString.toLowerCase().startsWith('x ') || nameString.startsWith('@ ') || nameString.startsWith('e ') || nameString.startsWith('D ') || nameString.startsWith('& ')) {
          nameString = nameString.substring(2);
        }

        if (!!nameString.substring(0, 1).match(/[a-z]/)) {
          nameString = nameString.substring(1);
        }

        if (nameString.startsWith('lon')) {
          nameString.replace('lon', 'Ion');
        }

        weapon.name = nameString;
        weapon.atk = source[key][index + 1];
      }

      if (text === 'CRT') {
        weapon.crit = source[key][index + 1];
      }

      if (_.includes(text, 'Load')) {
        weapon.load = text.split(' ')[1];
      }

      if (_.includes(text, 'LV')) {
        weapon.description = source[key][index - 1];
      }

      // if (_.includes(text, '[SP')) {
      //   if (!!text.match(/\[SP/i)) {
      //     const activeSkillName = text.substring(0, text.indexOf('[SP'));
      //   }
      // }
    });
  }

  return weapon;
}