"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sqlite = require("nativescript-sqlite");
var ListViewLoadOnDemandMode;
(function (ListViewLoadOnDemandMode) {
    /**Load on demand is disabled. */
    ListViewLoadOnDemandMode[ListViewLoadOnDemandMode["None"] = 0] = "None";
    /** A special load-on-demand item is appended at the end of the scrollable list which, when clicked initiates a request for more items. */
    ListViewLoadOnDemandMode[ListViewLoadOnDemandMode["Manual"] = 1] = "Manual";
    /** A request for more items will automatically be initiated after the user approaches the end of the scrollable list. */
    ListViewLoadOnDemandMode[ListViewLoadOnDemandMode["Auto"] = 2] = "Auto";
})(ListViewLoadOnDemandMode = exports.ListViewLoadOnDemandMode || (exports.ListViewLoadOnDemandMode = {}));
var database;
(function (database) {
    database[database["ResultsAsArray"] = 1] = "ResultsAsArray";
    database[database["ResultsAsObject"] = 2] = "ResultsAsObject";
    database[database["ValuesAreNative"] = 4] = "ValuesAreNative";
    database[database["ValuesAreString"] = 8] = "ValuesAreString";
})(database = exports.database || (exports.database = {}));
;
var Sqlite = /** @class */ (function () {
    function Sqlite(dbname) {
        var me = this;
        if (dbname)
            me.dbOpen(dbname);
    }
    /** Open the database
    **database will be created if it does not exist.
    */
    Sqlite.prototype.dbOpen = function (dbname) {
        var me = this;
        if (dbname)
            me.dbName = dbname;
        return new Promise(function (resolve, reject) {
            if (!me.dbName) {
                reject("No database name");
                return;
            }
            if (me.db) {
                resolve();
                return;
            }
            new sqlite(me.dbName).then(function (db) {
                me.db = db;
                me.db.resultType(database.ResultsAsObject);
                resolve();
                return;
                //                return me.version();
                //            }).then((version: number) => {
                //                if (version == 0) return me.createTables();
                //                resolve();
            }).catch(function (err) {
                var error = new Error("Failed to open database (" + me.dbName + ". " + err);
                reject(error);
            });
        });
    };
    /** Overloadable function to create the database */
    Sqlite.prototype.createTables = function () {
        var me = this;
        return new Promise(function (resolve, reject) {
            resolve();
        });
    };
    /** True if the database exists in the App/OS Database folder */
    Sqlite.prototype.exists = function (dbname) {
        return sqlite.exists();
    };
    /** Delete the database */
    Sqlite.prototype.deleteDatabase = function (dbname) {
        sqlite.deleteDatabase();
    };
    /** Used for "update", "insert", "delete" and any other sqlite command where you are not expecting a result set back.
    ** If this is an Insert it will return the last row id of the new inserted record.
    ** If it is an update/delete it will return the number of rows affected.
    ** execSQL("insert into table (description) values (?)", ["Hi"]);
    */
    Sqlite.prototype.execute = function (sql, params) {
        var me = this;
        return me.db.execSQL(sql, params);
    };
    /** Get row
     ** fetch('select * from table where rowid = ?', [1])
    */
    Sqlite.prototype.fetch = function (sql, params) {
        var me = this;
        return me.db.get(sql, params);
    };
    /** Get rows
     ** select('select * from table where rowid > ? and rowid < ?', [1,100])
    */
    Sqlite.prototype.select = function (sql, params) {
        var me = this;
        return me.db.all(sql, params);
    };
    /** Get/Set version */
    Sqlite.prototype.version = function (version) {
        var me = this;
        return me.db.version(version);
    };
    /** Is the current database open true/false */
    Sqlite.prototype.isopen = function () {
        var me = this;
        return me.db.isopen();
    };
    /** Closes the database */
    Sqlite.prototype.close = function () {
        var me = this;
        return me.db.close();
    };
    /** Check if table exists */
    Sqlite.prototype.tableExists = function (tableName) {
        var me = this;
        return new Promise(function (resolve, reject) {
            me.fetch("select * from sqlite_master where type = 'table' and name = ?", [tableName]).then(function (data) {
                resolve(!!data);
            }).catch(function (error) {
                alert(error.message);
                reject(error);
            });
        });
    };
    return Sqlite;
}());
exports.Sqlite = Sqlite;
var BaseEntity = /** @class */ (function () {
    function BaseEntity(dbname) {
        this.dbname = "messenger.db";
        this.isOpen = false;
        /** The name of the primary key column in the database */
        this.primaryKeyColumn = "rowid";
        /** The column in the table that is the primary description column (defaults to description) */
        this.descriptionColumn = "description";
        /** A buffer containing a single table row */
        this.row = {};
        /** An array of rows */
        this.rows = [];
        /** Total number of rows in the table */
        this.totalRows = 0;
        /** The start row number */
        this.startRow = 0;
        /** End of File reached*/
        this.eof = false;
        /** Number of rows to fetch*/
        this.pageSize = 30;
        //** script to create table */
        this.createScriptColumns = '';
        var me = this;
        me.sqlite = new Sqlite(dbname);
    }
    Object.defineProperty(BaseEntity.prototype, "table", {
        /** The name of the table */
        get: function () { return this._table; },
        set: function (table) { this._table = table; },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(BaseEntity.prototype, "dbColumns", {
        /** An array of columns that exist in the database */
        get: function () { return Object.keys(this.baseRow); },
        enumerable: true,
        configurable: true
    });
    BaseEntity.prototype.open = function () {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (me.isOpen) {
                resolve();
                return;
            }
            me.sqlite = new Sqlite();
            me.sqlite.dbOpen(me.dbname).then(function () {
                return me.sqlite.tableExists(me.table);
            }).then(function (isExists) {
                if (!isExists)
                    return me.createTable();
            }).then(function () {
                me.isOpen = true;
                resolve();
            }).catch(function (error) {
                alert(error.message);
                reject(error);
            });
        });
    };
    BaseEntity.prototype.createTable = function () {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!me.createScriptColumns) {
                resolve();
                return;
            }
            var sql = "CREATE TABLE " + me.table + " (" + me.createScriptColumns + ")";
            //      me.sqlite.execute(, [, me.createScriptColumns]).then((data) => {
            me.sqlite.execute(sql).then(function (data) {
                resolve();
            }).catch(function (error) {
                alert(error.message);
                reject(error);
            });
        });
    };
    /** Fetch rows from the database and place them in the entities rows array */
    BaseEntity.prototype.fetchRows = function (fetchOption) {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!fetchOption)
                fetchOption = {};
            //If there is already data in the rows array, just return that data
            if (fetchOption.useCache && me.rows.length != 0 && fetchOption.action == "None") {
                resolve(me.rows);
                return;
            }
            if (fetchOption.usePaging) {
                if (fetchOption.action == "Refresh")
                    me.rows = [];
                if (!fetchOption.limit)
                    fetchOption.limit = me.pageSize;
                if (!fetchOption.offset)
                    fetchOption.offset = me.startRow + me.rows.length;
                fetchOption.total = true;
            }
            var sql = "select " + (fetchOption.columns || me.primaryKeyColumn + ", *") + " from " + me.table;
            if (fetchOption.where)
                sql += " where " + fetchOption.where;
            if (fetchOption.order)
                sql += " order by " + fetchOption.order;
            if (fetchOption.offset)
                sql += " offset " + fetchOption.offset;
            if (fetchOption.limit)
                sql += " limit " + fetchOption.limit;
            me.open().then(function () {
                return me.sqlite.select(sql);
            }).then(function (data) {
                me.eof = true;
                me.rows = data;
                resolve(data);
            }).catch(function (error) {
                reject(error);
            });
        });
    };
    ;
    /** Fetch a row from the database and place it in the entities row object. If you leave the recordid blank it will try use the recordid from the row array */
    BaseEntity.prototype.fetchRow = function (recordId) {
        var me = this;
        if (!recordId && me.row)
            recordId = me.row[me.primaryKeyColumn];
        return new Promise(function (resolve, reject) {
            if (!recordId) {
                resolve(me.row);
                return;
            }
            me.open().then(function () {
                var sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + me.primaryKeyColumn + " = " + recordId;
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error("Error fetching (" + recordId + ") from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch a row from the database and place it in the entities row object.
     ** If you leave the column blank it will use the description column;
     */
    BaseEntity.prototype.fetchRowByColumn = function (value, column) {
        var me = this;
        if (!column)
            column = me.descriptionColumn;
        return new Promise(function (resolve, reject) {
            if (!value || value == undefined) {
                me.row = {};
                resolve(me.row);
                return;
            }
            me.open().then(function () {
                var sql;
                value = "'" + value.replace(/'/g, "''") + "'";
                sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " = " + value;
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error("Error fetching row where (" + column + " = " + value + ") from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch a row from the database and place it in the entities row object.
 ** If you leave the column blank it will use the description column;
 */
    BaseEntity.prototype.fetchRowByStringColumn = function (value, column, option) {
        var me = this;
        if (!column)
            column = me.descriptionColumn;
        return new Promise(function (resolve, reject) {
            if (!value || value == undefined) {
                me.row = {};
                resolve(me.row);
                return;
            }
            me.open().then(function () {
                var sql;
                switch (option) {
                    case "like":
                        value = "'%" + value.replace(/'/g, "''") + "%'";
                        sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " like " + value;
                        break;
                    case "startswith":
                        value = "'%" + value.replace(/'/g, "''") + "'";
                        sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " like " + value;
                        break;
                    default:
                        value = "'" + value.replace(/'/g, "''") + "'";
                        sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " = " + value;
                }
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error("Error fetching row where (" + column + " = " + value + ") from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch a row from the database and place it in the entities row object.
     ** If you leave the column blank it will use the description column;
     */
    BaseEntity.prototype.fetchRowByNumberColumn = function (value, column, option) {
        var me = this;
        if (!column)
            column = me.descriptionColumn;
        return new Promise(function (resolve, reject) {
            if (!value || value == undefined) {
                me.row = {};
                resolve(me.row);
                return;
            }
            me.open().then(function () {
                var sql;
                switch (option) {
                    case "greater than":
                        sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " > " + value;
                        break;
                    case "less than":
                        sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " < " + value;
                        break;
                    default:
                        sql = "select " + me.primaryKeyColumn + ", * from " + me.table + " where " + column + " = " + value;
                }
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error("Error fetching row where (" + column + " = " + value + ") from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch a row from the database and place it in the entities row object. If you leave the recordid blank it will try use the recordid from the row array */
    BaseEntity.prototype.fetchRowBySql = function (sql) {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!sql) {
                resolve({});
                return;
            }
            me.open().then(function () {
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error("Error fetching rowid column from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch a rows id using the decription column */
    BaseEntity.prototype.fetchRowId = function (description) {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!description) {
                resolve(0);
                return;
            }
            var value = "'" + description.replace(/'/g, "''") + "'";
            me.open().then(function () {
                var sql = "select " + me.primaryKeyColumn + " from " + me.table + " where " + me.descriptionColumn + " = " + value;
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                if (!data)
                    data = {};
                me.row[me.primaryKeyColumn] = data.rowid || 0;
                resolve(me.row[me.primaryKeyColumn]);
            }).catch(function (err) {
                var error = new Error("Error fetching rowid for (" + description + ") from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch a rowid from the database by alternate column. */
    BaseEntity.prototype.fetchRowIdByColumn = function (value, column, option) {
        var me = this;
        if (!column)
            column = me.descriptionColumn;
        return new Promise(function (resolve, reject) {
            if (!value || value == undefined) {
                me.row = {};
                resolve(0);
                return;
            }
            me.open().then(function () {
                var sql;
                switch (option) {
                    case "like":
                        value = "'%" + value.replace(/'/g, "''") + "%'";
                        sql = "select " + me.primaryKeyColumn + " from " + me.table + " where " + column + " like " + value;
                        break;
                    case "startswith":
                        value = "'%" + value.replace(/'/g, "''") + "'";
                        sql = "select " + me.primaryKeyColumn + " from " + me.table + " where " + column + " like " + value;
                        break;
                    default:
                        value = "'" + value.replace(/'/g, "''") + "'";
                        sql = "select " + me.primaryKeyColumn + " from " + me.table + " where " + column + " = " + value;
                }
                return me.sqlite.fetch(sql);
            }).then(function (data) {
                if (!data)
                    data = {};
                me.row[me.primaryKeyColumn] = data.rowid || 0;
                resolve(me.row[me.primaryKeyColumn]);
            }).catch(function (err) {
                var error = new Error("Error fetching rowid for (" + column + ") from " + me.table + ". " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** Fetch rows from the database and place them in the entities rows array */
    BaseEntity.prototype.fetchList = function (listView, fetchOption) {
        var me = this;
        listView.focus();
        return new Promise(function (resolve, reject) {
            me.fetchRows(fetchOption).then(function (data) {
                if (fetchOption.action == "Refresh")
                    listView.items.splice(0);
                listView.items.push.apply(listView.items, data);
                listView.loadOnDemandMode = me.eof
                    ? ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.None]
                    : ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.Auto];
                if (fetchOption.action == "Refresh" || fetchOption.action == "LoadPrevious")
                    listView.notifyPullToRefreshFinished();
                if (fetchOption.action == "LoadMore")
                    listView.notifyLoadOnDemandFinished();
                resolve(data);
            }).catch(function (err) {
                listView.loadOnDemandMode = ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.None];
                if (fetchOption.action == "Refresh" || fetchOption.action == "LoadPrevious")
                    listView.notifyPullToRefreshFinished();
                if (fetchOption.action == "LoadMore")
                    listView.notifyLoadOnDemandFinished();
                alert(err.message);
                reject(err);
            });
        });
    };
    /** Fetch rows from the database and place them in the entities rows array */
    BaseEntity.prototype.radList = function (data, listView, fetchOption) {
        var me = this;
        listView.focus();
        return new Promise(function (resolve, reject) {
            if (!fetchOption.usePaging)
                me.eof = true;
            if (fetchOption.action == "Refresh")
                listView.items.splice(0);
            listView.items.push.apply(listView.items, data);
            listView.loadOnDemandMode = me.eof
                ? ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.None]
                : ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.Auto];
            if (fetchOption.action == "Refresh" || fetchOption.action == "LoadPrevious")
                listView.notifyPullToRefreshFinished();
            if (fetchOption.action == "LoadMore")
                listView.notifyLoadOnDemandFinished();
            resolve(data);
        });
    };
    BaseEntity.prototype.saveRow = function (row) {
        var me = this;
        if (row)
            me.row = row;
        if (me.row[me.primaryKeyColumn]) {
            return me.updateRow(row);
        }
        else {
            return me.insertRow(row);
        }
    };
    ;
    /** insert a row*/
    BaseEntity.prototype.insertRow = function (row) {
        var me = this;
        return new Promise(function (resolve, reject) {
            row = me.getSanitisedColumns(row || me.row);
            var columns = [];
            var values = [];
            for (var key in row) {
                if (!row.hasOwnProperty(key))
                    continue;
                if (key == me.primaryKeyColumn)
                    continue;
                var value = row[key];
                if (value == undefined)
                    value = '';
                if (typeof (value) == "object")
                    value = JSON.stringify(value);
                if (typeof (value) == "string" && value != "null")
                    value = "'" + value.replace(/'/g, "''") + "'";
                columns.push(key);
                values.push(value);
            }
            if (columns.length == 0) {
                var error = new Error("Error adding " + me.table + " data. No columns suppiled");
                alert(error.message);
                reject(error);
                return;
            }
            var sql = "insert into " + me.table + " (" + columns.join() + ") values(" + values.join() + ")";
            me.open().then(function () {
                return me.sqlite.execute(sql);
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function (rowid) {
                me.row = row;
                me.row[me.primaryKeyColumn] = rowid;
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error("Error adding " + me.table + " data. " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** update a row*/
    BaseEntity.prototype.updateRow = function (row) {
        var me = this;
        return new Promise(function (resolve, reject) {
            row = me.getSanitisedColumns(row || me.row);
            if (!row) {
                resolve();
                return;
            }
            var columns = [];
            for (var key in row) {
                if (!row.hasOwnProperty(key))
                    continue;
                if (key == me.primaryKeyColumn)
                    continue;
                var value = row[key];
                if (typeof (value) == "object")
                    value = JSON.stringify(value);
                if (typeof (value) == "string")
                    value = "'" + value.replace(/'/g, "''") + "'";
                columns.push(key + " = " + value);
            }
            var sql = "update " + me.table + " set " + columns.join() + " where " + me.primaryKeyColumn + " = " + row[me.primaryKeyColumn];
            me.open().then(function () {
                return me.sqlite.execute(sql);
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function (rowid) {
                me.row = row;
                resolve(row);
            }).catch(function (err) {
                var error = new Error("\"Error updating " + me.table + " data. " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** update a column
     ** The corresponding row item will be updated too
     ** Leaving value blank will use the rows value
     ** where: use an alternate where clause
    */
    BaseEntity.prototype.updateColumn = function (rowid, column, value) {
        var me = this;
        if (!rowid || rowid == undefined || !column || column == undefined) {
            return new Promise(function (resolve, reject) {
                resolve(value);
                return;
            });
        }
        var where = me.primaryKeyColumn + " = " + rowid;
        return me.updateColumnWhere(column, value, where);
    };
    BaseEntity.prototype.updateColumnWhere = function (column, value, where) {
        var me = this;
        if (value == undefined)
            value = me.row[column];
        return new Promise(function (resolve, reject) {
            if (!where) {
                me.row[column] = value;
                resolve(value);
                return;
            }
            var colValue = typeof (value) == "string" ? "'" + value.replace(/'/g, "''") + "'" : value;
            var sql = "update " + me.table + " set " + column + " = " + colValue + " where " + where;
            me.open().then(function () {
                return me.sqlite.execute(sql);
            }).then(function (affected) {
                me.row[column] = value;
                resolve(value);
            }).catch(function (err) {
                var error = new Error("\"Error updating " + me.table + " data. " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** update a column
    ** The corresponding row item will be updated too
   */
    BaseEntity.prototype.updateColumns = function (rowid, columns) {
        var me = this;
        return new Promise(function (resolve, reject) {
            var columnsArray = [];
            for (var key in columns) {
                if (!columns.hasOwnProperty(key))
                    continue;
                if (key == me.primaryKeyColumn)
                    continue;
                var value = columns[key];
                if (typeof (value) == "object")
                    value = JSON.stringify(value);
                if (typeof (value) == "string")
                    value = "'" + value.replace(/'/g, "''") + "'";
                columnsArray.push(key + " = " + value);
            }
            if (!rowid || rowid == undefined || columnsArray.length == 0) {
                resolve();
                return;
            }
            var sql = "update " + me.table + " set " + columnsArray.join() + " where " + me.primaryKeyColumn + " = " + rowid;
            me.open().then(function () {
                return me.sqlite.execute(sql);
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function () {
                me.row[me.primaryKeyColumn] = rowid;
                for (var key in columns) {
                    if (!columns.hasOwnProperty(key))
                        continue;
                    me.row[key] = columns[key];
                }
                resolve(columns);
            }).catch(function (err) {
                var error = new Error("\"Error updating " + me.table + " data. " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** delete a row */
    BaseEntity.prototype.deleteRow = function (rowid) {
        var me = this;
        return new Promise(function (resolve, reject) {
            rowid = rowid || me.row[me.primaryKeyColumn];
            var sql = "delete from " + me.table + " where " + me.primaryKeyColumn + " = " + rowid;
            me.open().then(function () {
                return me.sqlite.execute(sql);
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function (rowid) {
                resolve(rowid);
                me.row[me.primaryKeyColumn] = rowid;
            }).catch(function (err) {
                var error = new Error("\"Error deleting " + me.table + " data. " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** execute a sql function */
    BaseEntity.prototype.execute = function (sql) {
        var me = this;
        return new Promise(function (resolve, reject) {
            me.open().then(function () {
                return me.sqlite.execute(sql);
            }).then(function (rowid) {
                resolve();
            }).catch(function (err) {
                var error = new Error("\"Error executing script. " + err);
                alert(error.message);
                reject(error);
            });
        });
    };
    ;
    /** clean data, removing columns that are not in the entities database columns */
    BaseEntity.prototype.getSanitisedColumns = function (row) {
        var me = this;
        var dbRow = {};
        for (var col in row) {
            var colName = col.toLowerCase();
            if (me.dbColumns.indexOf(colName) != -1)
                dbRow[colName] = row[colName];
        }
        return dbRow;
    };
    return BaseEntity;
}());
exports.BaseEntity = BaseEntity;
