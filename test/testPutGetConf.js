'use strict'

const Snap = require('../src/index.js')

async function main(){

  let snap = new Snap()

  await snap.readAuth()
    .then(res => console.log('snap.readAuth() ->', res))
    .catch(error => console.log('fail! snap.readAuth() ->', error))

  await snap.listSnaps()
    .then(res => console.log('snap.listSnaps() ->', res))
    .catch(error => console.log('fail! snap.listSnaps() ->', error))

  await snap.info({name:'core'})
    .then(res => console.log('snap.info(\'core\') ->', res))
    .catch(error => console.log('fail! snap.info(\'core\') ->', error))

  await snap.putConf({"name": "test-configure", "keys":{"age":"1", "speed":"2"}})
    .then(res => console.log('snap.putConf(\'"test-configure"\') ->', res))
    .catch(error => console.log('fail! snap.putConf(\'"test-configure"\') ->', error))

  await timeout(1000)

  await snap.getConf({"name": "test-configure", "keys":["age", "speed"]})
    .then(res => console.log('snap.getConf(\'"test-configure"\') ->', res))
    .catch(error => console.log('fail! snap.getConf(\'"test-configure"\') ->', error))

  await snap.putConf({"name": "test-configure", "keys":{"age":"7", "speed":"8"}})
    .then(res => console.log('snap.putConf(\'"test-configure"\') ->', res))
    .catch(error => console.log('fail! snap.putConf(\'"test-configure"\') ->', error))

  await timeout(1000)

  await snap.getConf({"name": "test-configure", "keys":["age", "speed"]})
      .then(res => console.log('snap.getConf(\'"test-configure"\') ->', res))
      .catch(error => console.log('fail! snap.getConf(\'"test-configure"\') ->', error))
  

  




}
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().then().catch(err=>{
  console.log('main error', err)
})