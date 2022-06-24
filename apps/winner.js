'use strict';
const { response } = require("../init/res");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const { addNotification } = require('../init/addNotification')
const TableName = process.env.WINNER_TABLE;
const fields = {
    winnerId: { type: String, default: uuid() },
    userId: { type: String },
    username: { type: String },
    eventName: { type: String },
    image: { type: String },
    result: { type: Number },
    eventPrice: { type: Number },
    point: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
module.exports.push = async (item) => {
    let data = convertData(fields, item);
    // console.log(data)
    return db.put(
        {
            TableName: TableName,
            Item: data,
        }
    ).promise()

};
module.exports.getAll = async (event, context, callback) => {
    const params = {
        TableName: TableName
    }
    return db.scan(params)
        .promise()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};
