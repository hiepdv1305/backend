module.exports.convertData = (fields, data) => {
    let dataFinal = {};
    Object.keys(fields).forEach((fieldName) => {
        console.log('fieldName', fieldName)
        dataFinal[fieldName] = data[fieldName] || fields[fieldName].default
    });
    return dataFinal;
}