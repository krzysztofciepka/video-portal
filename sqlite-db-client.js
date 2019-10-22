const sqlite3 = require('sqlite3').verbose();

class SqliteDbClient {
    constructor(dbPath){
        this.dbPath = dbPath;
    }

    async connect(){
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if(err){
                    return reject(err);
                }
                resolve();
            });
        });
    }

    async count(){
        return new Promise((resolve, reject) => {
            this.db.all('SELECT COUNT(*) FROM videos', (err, rows) => {
                if(err){
                    return reject(err)
                }
                resolve(rows[0]['COUNT(*)'])
            });
        });
    }

    async createTable(){
        this.db.run(`CREATE TABLE IF NOT EXISTS videos(
            id TEXT PRIMARY KEY, 
            name TEXT, 
            size INTEGER, 
            path TEXT, 
            duration TEXT, 
            created_at TEXT, 
            type TEXT, 
            thumbnails TEXT
            )`
        )
    }

    async dropTable(){
        this.db.run('DROP TABLE IF EXISTS videos');
    }

    async insertOne(item){
        this.db.run(`INSERT INTO videos (
            id, 
            name, 
            size, 
            path, 
            duration, 
            created_at, 
            type, 
            thumbnails) 
            VALUES(
            '${item.id}',
            "${item.name}",
            ${item.size},
            '${item.path}',
            '${item.duration}',
            '${new Date(item.created_at).toISOString()}',
            '${item.type}',
            '${item.thumbnails.join('   ')}'
            )`
        )
    }

    async selectById(id) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM videos WHERE id = '${id}'`, (err, rows) => {
                if(err){
                    return reject(err)
                }
                if(!rows || !rows.length){
                    return null;
                }
                rows[0].thumbnails = rows[0].thumbnails.split('   ')
                resolve(rows[0]);
            })
        });
    }

    async select(query, sort, offset, limit){
        const key = Object.keys(query)[0];

        const sortKey = Object.keys(sort)[0]
        const sortOrder = sort[sortKey] === 1 ? 'ASC' : 'DESC';

        return new Promise((resolve, reject) => {
             this.db.all(
                `SELECT * FROM videos ${key ? `WHERE ${key} = '${query[key]}'` : ` `} 
                    ORDER BY ${sortKey} ${sortOrder} 
                    LIMIT ${limit} 
                    OFFSET ${offset}`, (err, rows) => {
                    if(err){
                        return reject(err)
                    }
                    resolve(rows.map(item => {
                        return {
                            id: item.id,
                            name: item.name,
                            size: item.size,
                            path: item.path,
                            duration: item.duration,
                            created_at: item.created_at,
                            type: item.type,
                            thumbnails: item.thumbnails.split('   ')
                        }
                    }));
                });      
        })
    }

    async selectRandom(count){
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM videos ORDER BY RANDOM() LIMIT ${count}`, (err, rows) => {
                if(err){
                    return reject(err)
                }
                resolve(rows.map(item => {
                    return {
                        id: item.id,
                        name: item.name,
                        size: item.size,
                        path: item.path,
                        duration: item.duration,
                        created_at: item.created_at,
                        type: item.type,
                        thumbnails: item.thumbnails.split('   ')
                    }
                }));
            })
        });
    }

    async close(){
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if(err){
                    return reject(err)
                }
                resolve();
            });
        })
        
    }
}


module.exports = SqliteDbClient;