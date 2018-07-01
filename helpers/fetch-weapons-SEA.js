const fs = require('fs-extra');
const cheerio = require('cheerio');
const axios = require('axios');
const _ = require('lodash');

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
    console.log('equipment urls: ', equipments);
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
        let name = $(element).find('.wpb_text_column h2 span').text() || $(element).find('.wpb_text_column h2').text();
        let statsContainer = Array.from($(element).find('.wpb_text_column.wpb_content_element + .vc_row.vc_inner .vc_col-sm-4 table tbody tr:last-child').find('td'));
        let stats = {atk: $(statsContainer[0]).text(), crit: $(statsContainer[1]).text()};
        let skillContainer = Array.from($(element).find('.vc_row.vc_inner + .vc_row.vc_inner .wpb_text_column.wpb_content_element .wpb_wrapper p'));
        let skills = {};
        skillContainer.forEach((container, index) => {
          const text = $(container).text();
          const textLower = text.toLowerCase();
          const separationRegex = textLower.match(/skill ?\d?:/i);
          // console.log('skill text: ', text);
          
          if (!!separationRegex) {
            const separationWord = separationRegex[0];
            const colonPos = text.toLowerCase().indexOf(separationWord) + separationWord.length;
            skills[text.substring(0, colonPos - 1).trim()] = text.substring(colonPos).trim();
          }
        });

        let equipment = {name: name, stats: stats, skills: skills, category: equipmentCategory, rank: equipmentRank};
        equipmentArr.push(equipment);
      }
    } catch (err) {
      console.log('error when parsing equipment data: ', err);
    }
  }

  return equipmentArr;
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
    const activeSkill = item.skills['Active Skill'] || item.skills['Active Skill 2'] || '';
    return {
      name: item.name,
      atk: item.stats.atk,
      crit: item.stats.crit,
      category: weaponCategory[item.category],
      rank: item.rank,
      active_skill: item.skills['Active Skill'] || item.skills['Active Skill 2'] || '',
      passive_skill_1: item.skills['Passive Skill'] || '',
      passive_skill_2: item.skills['Passive Skill 2'] || '',
      debuffs: getDebuff(activeSkill),
      elements: getElemental([
        item.skills['Active Skill'],
        item.skills['Active Skill 2'],
        item.skills['Passive Skill'],
        item.skills['Passive Skill 2']
      ])
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
    'DEF down': ['vulnerable status', /decrea[se|sing].+defen[s|c]e/i,/redu[ce|cing].+defen[s|c]e/i, 'reduce def'],
    'ATK down': ['weaken status', /decrea[se|sing].+attack power/i,/redu[ce|cing].+attack power/i],
    'paralyze': ['paralysis', 'paralyze'],
    'bind': ['bind', 'shackle'],
    'bleed': ['bleed ', 'bleeding'],
    'decelerated': ['decelerated', 'space-time', 'space time'],
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

getEquipmentUrls(urlWeapon).then(async (result) => {
  let parsed = await parseEquipment(result);
  console.log('parsed: ', parsed);
  let formatted = formatWeaponData(parsed);
  console.log('formatted: ', formatted);

  fs.outputFile('./fetched/weapon-list-SEA.json', JSON.stringify(formatted, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
  console.log('DONE');
});