const editJsonFile = require('edit-json-file')

const manifest = require('../src/manifest.json')
const manifestVersion = manifest.version

const packageFile = editJsonFile(`${__dirname}/../package.json`)
packageFile.set('version', manifestVersion)
packageFile.save()
