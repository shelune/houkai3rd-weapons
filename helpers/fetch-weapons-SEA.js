const fs = require('fs-extra');
const util = require('util');
const cheerio = require('cheerio');
const axios = require('axios');
const _ = require('lodash');
const base64Img = require('base64-img');
const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient({
  keyFilename: './google-vision-key.json'  
});

const urlWeapon = 'http://houkai3rd.arthobbylab.com/weapon';

let getEquipmentUrls = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    let equipments = [];
    let equipmentRanks = Array.from($('.vc_figure a'));
    
    for (let link of equipmentRanks) {
      const href = $(link).attr('href');
      const nameSlug = href.substring(href.indexOf('weapon/') + 7, href.length).replace('/', '');
      const name = nameSlug.replace(/-/gm, '');
      let weapon = {name: nameSlug, url: href};
      equipments.push(weapon);
    }
    // console.log('equipment urls: ', equipments);
    return equipments;
  } catch (err) {
    console.log('error when getting page content: ', err);
  }
}

let parseEquipment = async (items) => {
  let equipmentArr = [];
  for (let item of items) {
    // console.log('weapon category: ', category);
    const { name, url } = item;
    let equipmentCategory, equipmentRank;
    const equipmentCategoryMatch = name.match(/(\D+)-(\d)/i);
    if (!!equipmentCategoryMatch) {
      equipmentCategory = equipmentCategoryMatch[1];
      equipmentRank = equipmentCategoryMatch[2];
    }

    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      let elements = Array.from($(`.entry-content > .vc_row.wpb_row.vc_row-fluid[id] ~ .vc_row.wpb_row.vc_row-fluid > .vc_col-sm-12 > .vc_column-inner > .wpb_wrapper`));

      // console.log('weapon elements: ', elements);
    
      for (let index in elements) {
        let element = elements[index];
        let image = $(element).find('.wpb_text_column.wpb_content_element + .vc_row.vc_inner .vc_col-sm-8 .vc_figure a img').attr('data-lazy-src');
        let name = $(element).find('.wpb_text_column h2 span').text() || $(element).find('.wpb_text_column h2').text();
        let statsContainer = Array.from($(element).find('.wpb_text_column.wpb_content_element + .vc_row.vc_inner .vc_col-sm-4 table tbody tr:last-child').find('td'));
        let stats = {atk: $(statsContainer[0]).text(), crit: $(statsContainer[1]).text()};
        let skillContainer = Array.from($(element).find('.vc_row.vc_inner + .vc_row.vc_inner .wpb_text_column.wpb_content_element .wpb_wrapper > *'));
        let skills = {
          active: '',
          passive: []
        };
        skillContainer.forEach((container, index) => {
          const text = $(container).text();
          const activeSkillText = text.toLowerCase().match(/active skill:/i);
          // console.log('skill text: ', text);
          
          if (!!activeSkillText) {
            const separationWord = activeSkillText[0];
            const colonPos = text.toLowerCase().indexOf(separationWord) + separationWord.length;
            skills.active = text.substring(colonPos).trim();
          } else {
            skills.passive.push(text);
          }
        });

        let equipment = {name, stats, skills, category: equipmentCategory, rank: equipmentRank, image};
        equipmentArr.push(equipment);
      }
    } catch (err) {
      console.log('error when parsing equipment data: ', err);
    }
  }

  return equipmentArr;
}

let formatActiveSkill = (data, name) => {
  const skill = {
    desc: '',
    sp: '',
    cooldown: ''
  }
  let statsRegex = /: ?\d+/gm;
  let statMatches = data.match(statsRegex);

  if (!!statMatches && statMatches.length >= 2) {
    skill.sp = statMatches[statMatches.length - 2].replace(': ', '');
    skill.cooldown = statMatches[statMatches.length - 1].replace(': ', '');
  }

  let descRegex = /.*\(/gm;
  let descMatches = data.match(descRegex);
  if (!!descMatches) {
    skill.desc = descMatches[0].substring(0, descMatches[0].length - 1)
  }

  return skill;
}

let formatWeaponData = (data) => {
  const weaponCategory = {
    'pistol': 'dual-gun',
    'cannon': 'cannon',
    'katana': 'katana',
    'claymore': 'greatsword',
    'cross': 'cross',
    'gauntlet': 'gauntlet'
  };
  return data.map(item => {
    const nameJP = !!mergeOCRDetections(item.textBlocks) ? _.replace(mergeOCRDetections(item.textBlocks)[0], / /g, '') : '';
    const passiveSkills = item.skills.passive.map(skill => {
      return skill.trim().replace(/\n/g, '. ');
    });

    const activeSkill = formatActiveSkill(item.skills.active, item.name);

    return {
      name: item.name,
      atk: item.stats.atk,
      crit: item.stats.crit,
      category: weaponCategory[item.category],
      rank: item.rank,
      active: activeSkill,
      passive: passiveSkills,
      debuffs: getDebuff(item.skills.active),
      elements: getElemental([
        activeSkill['desc'],
        ...item.skills.passive
      ]),
      image: item.image,
      nameJP: nameJP
    }
  });
}

let getDebuff = (skill) => {
  let debuffs = [];
  let debuffCues = {
    'stun': ['stun '],
    'slow': ['slow', 'slowing',' speed reduction ', /redu[ce|cing].+movement speed/i],
    'burn': ['burn'],
    'freeze': ['freeze'],
    'float': ['float'],
    'DEF -': ['vulnerable status', /decrea[se|sing].+defen[s|c]e/i,/redu[ce|cing].+defen[s|c]e/i, 'reduce def'],
    'ATK -': ['weaken status', /decrea[se|sing].+attack power/i,/redu[ce|cing].+attack power/i],
    'paralyze': ['paralysis', 'paralyze'],
    'bind': ['bind', 'shackle'],
    'bleed': ['bleed ', 'bleeding'],
    'timelock': ['decelerated', 'space-time', 'space time'],
    'amplified': ['receive extra', 'take more', 'take extra']
  }
  
  for (let key in debuffCues) {
    for (let cue in debuffCues[key]) {
      if (!!skill.match(debuffCues[key][cue])) {
        debuffs.push(key);
      }
    }
  }
  
  return _.uniq(debuffs);
}

let getElemental = (skills) => {
  let elementals = [];
  let elementalCues = {
    'ice': ['ice elemental', 'ice/'],
    'fire': ['fire elemental', 'fire/', 'burn'],
    'electric': ['electric elemental', 'electric/', 'lightning']
  }

  for (let key in elementalCues) {
    if (skills.some(skill => {
      return !!skill ? elementalCues[key].some(cue => {
        return skill.match(cue);
      }) : false;
    })) {
      elementals.push(key);
    }
  }

  return _.uniq(elementals);
}

const detectOCR = async (path) => {
  try {
    const results = await client.documentTextDetection(path);
    return results;
  } catch (err) {
    console.log('error when detecting OCR:', err);
  }
};

const mergeOCRDetections = (source) => {
  try {
    if (!source) {
      return [];
    }

    const detections = source[0].fullTextAnnotation;
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
    const filtered = blocks.filter(text => {
      return text.length > 2;
    });
    return filtered;
  } catch (err) {
    console.log('error when merging ocr together: ', err);
  }
}

const getJPName = async (weaponList) => {
  try {
    const weaponListWithJPName = await Promise.all(weaponList.map(async weapon => {
      const outputFileName = weapon.image.match(/([^\/]+$)/i) ? weapon.image.match(/([^\/]+$)/i)[0] : 'Random Image';
      // await downloadImages(weapon.image, outputFileName);
      const textBlocks = await detectOCR('./images/houkai-weps-SEA/' + outputFileName);
      
      return {
        ...weapon,
        textBlocks,
      }
    }));
    console.log('weapon with jp name: ', weaponListWithJPName);
    return weaponListWithJPName;
  } catch (err) {
    console.log('error when attempt to get JP name: ', err);
  }
}

const downloadImages = async (url, destinationName) => {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      responseType: 'arraybuffer'
    });
    console.log('writing file nao: ', url);
    fs.writeFileSync(`./images/houkai-weps-SEA/${destinationName}`, response.data);
  } catch (err) {
    console.log('error when downloading image', err);
  }
}

console.log('Getting equipment data...');

getEquipmentUrls(urlWeapon).then(async (weaponList) => {
  try {
    console.log('Equipment data obtained. Parsing equipment data...');
    let parsed = await parseEquipment(weaponList);
    // console.log('parsed: ', parsed);
    console.log('Equipment parsed. Getting JP name out of images...');
    let ocr = await getJPName(parsed);
    console.log('JP name processed. Attempting to format data...');
    let formatted = formatWeaponData(ocr);
    let result = formatted;
    // console.log('result: ', result);

    fs.outputFile('./fetched/weapon-list-SEA.json', JSON.stringify(result, null, 4), (err) => {
      if (err) {
        console.log('error when writing file out: ', err)
      }
    });
    console.log('DONE');
  } catch (err) {
    console.log('ERROR when writing file', err);
  }
});


const getWeapons = (fileName) => {
  return readFile(fileName, 'utf8').then(file => {
    return JSON.parse(file);
  }).catch(err => {
    console.log('error when getting weapons', err);
  })
}
