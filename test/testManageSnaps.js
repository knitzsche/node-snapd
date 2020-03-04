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

  await snap.postApps({names:['test-apps'], action:'stop', enable:false, disable:false, reload:false})
    .then(res => console.log('snap.postApps(\'core\') ->', res))
    .catch(error => console.log('fail! snap.postApps(\'core\') ->', error))

  




}

main().then().catch(err=>{
  console.log('main error', err)
})