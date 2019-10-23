const sqlite3 = require('sqlite3').verbose();

class SqliteDbClient {
    constructor(dbPath) {
        this.dbPath = dbPath;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    }

    async count(query) {
        return new Promise((resolve, reject) => {
            const keys = Object.keys(query)
            let sql = 'SELECT COUNT(*) FROM videos'
            if (keys && keys.length) {
                let key = keys[0];
                sql = `SELECT COUNT(*) FROM videos WHERE ${key} LIKE '%${query[key].toString().replace('/i', '').replace('/', '')}%'`
            }
            this.db.all(sql, (err, rows) => {
                if (err) {
                    return reject(err)
                }
                resolve(rows[0]['COUNT(*)'])
            });
        });
    }

    async createTable() {
        this.db.run(`CREATE TABLE IF NOT EXISTS videos(
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT, 
            size INTEGER, 
            path TEXT, 
            duration_raw INTEGER,
            duration TEXT, 
            created_at INTEGER, 
            type TEXT, 
            thumbnails TEXT
            )`
        )
    }

    async dropTable() {
        this.db.run('DROP TABLE IF EXISTS videos');
    }

    async insertOne(item) {
        this.db.run(`INSERT INTO videos (
            name, 
            size, 
            path, 
            duration_raw,
            duration, 
            created_at, 
            type, 
            thumbnails) 
            VALUES(
            "${item.name}",
            ${item.size},
            "${item.path}",
            ${item.duration_raw},
            '${item.duration}',
            ${item.created_at},
            '${item.type}',
            '${item.thumbnails.join('   ')}'
            )`
        )
    }

    async selectById(id) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM videos WHERE id = '${id}'`, (err, rows) => {
                if (err) {
                    return reject(err)
                }
                if (!rows || !rows.length) {
                    return null;
                }
                rows[0].thumbnails = rows[0].thumbnails.split('   ')
                resolve(rows[0]);
            })
        });
    }

    async select(query, sort, offset, limit) {
        let sortKey = Object.keys(sort)[0]
        const sortOrder = sort[sortKey] === 1 ? 'ASC' : 'DESC';

        if (sortKey == 'duration') {
            sortKey = "duration_raw"
        }

        let sql = `SELECT * FROM videos WHERE ${sortKey} NOT IN 
        ( SELECT ${sortKey} FROM videos ORDER BY ${sortKey} 
            ${sortOrder} LIMIT ${offset} ) 
        ORDER BY ${sortKey} ${sortOrder} LIMIT ${limit}`

        const keys = Object.keys(query)
        if (keys && keys.length) {
            let key = keys[0];
            sql = `SELECT * FROM videos WHERE ${key} LIKE '%${query[key].toString().replace('/i', '').replace('/', '')}%' LIMIT ${limit} OFFSET ${offset}`
        }

        return new Promise((resolve, reject) => {
            this.db.all(
                sql, (err, rows) => {
                    if (err) {
                        return reject(err)
                    }
                    resolve(rows.map(item => {
                        return {
                            id: item.id,
                            name: item.name,
                            size: item.size,
                            path: item.path,
                            duration_raw: item.duration_raw,
                            duration: item.duration,
                            created_at: new Date(item.created_at),
                            type: item.type,
                            thumbnails: item.thumbnails.split('   ')
                        }
                    }));
                });
        })
    }

    async selectRandom(count) {
        return new Promise((resolve, reject) => {
            this.db.all(`SELECT * FROM videos ORDER BY RANDOM() LIMIT ${count}`, (err, rows) => {
                if (err) {
                    return reject(err)
                }
                resolve(rows.map(item => {
                    return {
                        id: item.id,
                        name: item.name,
                        size: item.size,
                        path: item.path,
                        duration_raw: item.duration_raw,
                        duration: item.duration,
                        created_at: new Date(item.created_at),
                        type: item.type,
                        thumbnails: item.thumbnails.split('   ')
                    }
                }));
            })
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    return reject(err)
                }
                resolve();
            });
        })

    }
}


module.exports = SqliteDbClient;