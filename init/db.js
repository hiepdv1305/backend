const AWS = require("aws-sdk");

let options = {}
// cau hinh dynamodb offline
// if(process.env.IS_OFFLINE){
//     options = {
//         region: 'localhost',
//         endpoint: 'http://localhost:8000',
//     }
// }
module.exports = new AWS.DynamoDB.DocumentClient(options);