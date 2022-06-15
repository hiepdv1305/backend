'use strict';
const { response } = require("../init/res");
const db = require('../init/db');
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const TableName = process.env.DEAL_TABLE;
const eventTable = process.env.EVENT_TABLE;
const fields = {
    dealId: { type: String, default: uuid() },
    eventId: { type: String },
    userId: { type: String },
    eventName: { type: String },
    image: { type: String },
    price: { type: Number },
    beginNumber: { type: Number },
    endNumber: { type: Number },
    point: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
module.exports.create = async (event, context, callback) => {

    let user = context.prev;
    const data = JSON.parse(event.body);
    return db.scan(
        {
            TableName: eventTable,
            FilterExpression: '#eventId = :eventId AND #status = :status',
            ExpressionAttributeNames: {
                '#eventId': 'eventId',
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':eventId': data.eventId,
                ':status': 'active'
            }
        }).promise().then(res => {
            db.update({
                TableName: eventTable,
                Key: {
                    eventId: data.eventId,
                },
                UpdateExpression: 'set #currentPoint = :currentPoint',
                ExpressionAttributeNames: {
                    "#currentPoint": "currentPoint"
                },
                ExpressionAttributeValues: {
                    ":currentPoint": res.Items[0].currentPoint + data.point,
                },
            }).promise()
            let dealdata = {
                userId: user.userId,
                eventId: data.eventId,
                point: data.point,
                beginNumber: res.Items[0].currentPoint,
                endNumber: res.Items[0].currentPoint + data.point - 1,
                image: data.image,
                eventName: data.eventName,
                price: data.price
            }
            dealdata = convertData(fields, dealdata);
            let dealparams = {
                TableName: TableName,
                Item: dealdata
            }
            return db.put(dealparams).promise()
                .then(res => {
                    return response(res, "succces", 200);
                }).catch(err => {
                    return response("", err, 400)
                })
        })
};

module.exports.eventGet = async (event, context, callback) => {
    const id = event.pathParameters.id;
    return db.scan(
        {
            TableName: TableName,
            FilterExpression: '#eventId = :eventId',
            ExpressionAttributeNames: {
                '#eventId': 'eventId',
            },
            ExpressionAttributeValues: {
                ':eventId': id,
            }
        }
    ).promise()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};

module.exports.userGet = async (event, context, callback) => {
    let user = context.prev;
    return db.scan(
        {
            TableName: TableName,
            FilterExpression: '#userId = :userId',
            ExpressionAttributeNames: {
                '#userId': 'userId',
            },
            ExpressionAttributeValues: {
                ':userId': user.userId,
            }
        }
    ).promise()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};