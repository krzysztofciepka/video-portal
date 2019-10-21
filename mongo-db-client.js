const MongoClient = require('mongodb').MongoClient;

class MongoDbClient {
    constructor(dbUrl, dbName) {
        this.dbUrl = dbUrl;
        this.dbName = dbName;
    }

    async connect() {
        this.db = await MongoClient.connect(this.dbUrl);
        this.dbo = db.db(this.dbName);
    }

    async insertOne(tableName, item) {
        await this.dbo.collection(tableName).insertOne(item);
    }

    async select(tableName, query, sort, offset, limit) {
        return await this.dbo.collection(tableName)
            .find(query)
            .sort(sort)
            .skip(offset)
            .limit(limit)
            .toArray();
    }

    async count(tableName) {
        return await this.dbo.collection(tableName)
            .countDocuments();
    }

    async selectOne(tableName, query) {
        return await this.dbo.collection(tableName)
            .findOne(query);
    }

    async selectRandom(tableName, count) {
        if (parseFloat(process.env.MONGO_VERSION || '0') < 3.6) {
            const itemsCount = await this.dbo.collection(tableName)
                .countDocuments();

            let randomItem = parseInt(Math.random() * itemsCount) - count;

            return await this.dbo.collection(tableName)
                .find()
                .limit(count)
                .skip(randomItem < 0 ? 0 : randomItem)
                .toArray()
        }

        return await app.locals.db.collection(tableName)
            .aggregate([{ $sample: { size: count } }])
            .toArray();
    }

    async createTable(tableName) {
        await dbo.createCollection(tableName);
    }

    async dropTable(tableName) {
        await dbo.dropCollection(tableName);
    }
}

module.exports = MongoDbClient;