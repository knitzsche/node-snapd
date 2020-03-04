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

  await snap.postApps({"names": ["test-apps"], "action":"stop"})
    .then(res => console.log('snap.postApps(\'"test-apps"\') ->', res))
    .catch(error => console.log('fail! snap.postApps(\'"test-apps"\') ->', error))

  




}

main().then().catch(err=>{
  console.log('main error', err)
})