const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient({
  keyFilename: './google-vision-key.json'  
});

// run Google Vision to get weapon data
fs.readdir('./images/houkai-weps-sample', (err, files) => {
  let results = [];
  files.forEach(file => {
    client
    .documentTextDetection('./images/houkai-weps-sample/' + file)
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
    })
    .catch(err => {
      console.error('ERROR: ', err);
    })
    .then(() => {
      let weaponData = results.map(result => parseInfo(result));
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
  const ranks = {
    '1': '1',
    '2': '15',
    '3': '25',
    '4': '35'
  };
  let weapon = {};
  for (let key in source) {
    source[key].forEach((text, index) => {
      if (text === 'ATK') {
        weapon.name = source[key][index - 1];
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
    });
  }

  return weapon;
}