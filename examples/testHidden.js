let carbon = require('../carbon-xv')('./examples/carbon.yml')
let org = carbon.organization()
org.setFields({
    id: '1235',
    name: 'XYZ Corp'
})
console.log(org.testHidden())