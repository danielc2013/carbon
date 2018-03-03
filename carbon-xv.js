/**
 * @todo If there are no required fields, the event emitters will fail
 * This is not a good way to manage the dependency. In later iteration,
 * remove the strong tie to required fields and provide custom fields
 * @todo make sure that required fields actually exist in the fields of 
 * the class definition yaml object
 * @todo Add an events field to the yaml definition file. This will make
 * the utility extensible above CRUD operations
 * @todo Procedurally add required fields 
 */
const yaml = require('js-yaml')
const fs   = require('fs')

let exportObjects = {}
let classes = {}
let events = []
module.exports = (ymlSrc) => {
    let srcFile = {}

    if (typeof ymlSrc === 'string'){
        try {
            srcFile = yaml.safeLoad(fs.readFileSync(ymlSrc))
        } catch (e) {
            throw e
        }
    }
    else if (typeof ymlSrc === 'object') {
        // Validate JSON
        try {
            srcFile = JSON.parse(JSON.stringify(ymlSrc))
        } catch (e) {
            throw e
        }
    } else {
        try {
            srcFile = yaml.safeLoad(fs.readFileSync('./carbon.yaml'))
        } catch (e) {
            throw e
        }
    }

    classes = srcFile.classes

    // Add events for emitters
    for (let ev in srcFile.events) 
        events.push(srcFile.events[ev])

    // Build the classes for export 
    for(let cls in classes){
        // Validate the Fields
        for (let field in classes[cls].fields)
            validateChain(classes[cls].fields[field])

        // Create an object for that class
        exportObjects[cls] = () => {
            return new ModuleClass({
                name: cls,
                requiredFields: classes[cls].required,
                fieldTypes: classes[cls].fields
            })
        }
    }

    return exportObjects
}

function ModuleClass (args) {
    if(!(this instanceof ModuleClass))
        return new ModuleClass(args)
    let requiredFields = args.requiredFields
    let fieldsTypes = args.fieldTypes

    let fieldValues = {}

    // TODO: Naming here is confusing, fix nomenclature
    function setFields (fields) {
        for(let field in fields){
            let constraint = classes[args.name].fields[field]
            let val = fields[field]

            // Check for validity of field
            if (checkValidity(val, constraint)){
                fieldValues[field] = val
            }
            else {
                let expectedVal = constraint.split(':')
                expectedVal = expectedVal[expectedVal.length - 1]
                throw new Error(`Expected type ${expectedVal}, received ${typeof val}`)
            }
        }
    }

    function emitEvent (event) {
        if (!events.includes(event))
            throw new Error(`Undefined event ${event} in class ${args.name}`)

        if(!requiredFields[event])
            return fieldValues

        for(let field in requiredFields[event]){
            if(!fieldValues[requiredFields[event][field]])
                throw new Error(`Missing field: ` + 
                `${requiredFields[event][field]} in ${event} call`)
        }

        return fieldValues
    }

    let rtrn = {
        name: args.name,
        setFields: setFields
    }

    for (let ev in events)
        rtrn[events[ev]] = () => { return emitEvent(events[ev]) }

    return rtrn
}

function checkValidity (val, restraint) {
    // Split the string into an array
    let chain = restraint.split(':')

    return chain.find((element, index) => {
        if (element[0] === '$')
            classCasing(val, chain, index)
        else if (element === 'array') {
            // Handle arrays of objects
        } else {
            return typeof val === element
        }
    })
}

function classCasing(val, chain, index){
    if (chain.length === index + 1) {
        return val instanceof ModuleClass // Needs to check further for class
    } else {
        return checkValidity(val, classes[chain[0].substring(1)].fields[chain[1]])
    }
}

function validateChain(str){
    let chain = str.split(':')

    return chain.forEach((element, index) => {
        if (element[0] === '$' && chain.length > index + 2)
            throw new Error(`Too many dependencies for reference ${element}`)
        else if (element[0] != '$' && element != 'array' &&
                 chain.length > index + 1)
            throw new Error(`Unable to access sub element ` +
                `${chain[index + 1]} of simple type ${element}`)
        else
            return true
    });
}
