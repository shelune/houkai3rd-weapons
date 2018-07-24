const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient({
  keyFilename: './google-vision-key.json'  
});

const detectOCR = async url => {
  const results = await client.documentTextDetection(url);
  return results;
}

detectOCR('http://houkai3rd.arthobbylab.com/wp-content/uploads/sites/2/2017/08/7th-Sacred-Relic.png').then(response => {
  console.log('response: ', response);
})