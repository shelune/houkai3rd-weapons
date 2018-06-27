const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');
const axios = require('axios');
const cheerio = require('cheerio');

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

      return {url, rank, atk};
    });

    console.log('weapons urls: ', weapons);
    return weapons;
  } catch (err) {
    console.log('error when getting page content: ', err);
  }
}

getWeaponUrls(urlSource).then(weaponList => {
  fs.writeFile('weapon-upgrades.json', JSON.stringify(weaponList, null, 4), (err) => {
    if (err) {
      console.log('error when writing file out: ', err)
    }
  });
})