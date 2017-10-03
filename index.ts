var sqlite = require("nativescript-sqlite");

import * as ObservableArrayModule from 'data/observable-array';
import * as listViewModule from 'nativescript-pro-ui/listview';

export enum ListViewLoadOnDemandMode {
    /**Load on demand is disabled. */
    None,
    /** A special load-on-demand item is appended at the end of the scrollable list which, when clicked initiates a request for more items. */
    Manual,
    /** A request for more items will automatically be initiated after the user approaches the end of the scrollable list. */
    Auto
}

export enum database {
    ResultsAsArray = 1,
    ResultsAsObject = 2,
    ValuesAreNative = 4,
    ValuesAreString = 8,
}
// Literal Defines

export type FetchEnum = "None" | "Refresh" | "LoadMore" | "LoadPrevious";

export interface FetchOptions {
    url?: string;
    columns?: string;
    where?: string;
    order?: string;
    tagging?: boolean;
    offset?: number;
    limit?: number;
    total?: boolean;
    /** if true and there is already data in the rows array then that data will be used, otherwise fresh data will be retrieved */
    useCache?: boolean;
    /** force refresh */
    refresh?: boolean;
    /** load on demand */
    usePaging?: boolean;
    tableparam?: any;
    action?: FetchEnum
};

export interface DB {
    /** Get/Set version */
    version(version?: number): Promise<number>;
    isopen(): boolean;
    close(): Promise<any>;
    /** Used for "update", "insert", "delete" and any other sqlite command where you are not expecting a result set back. 
     ** If this is an Insert it will return the last row id of the new inserted record. 
     ** If it is an update/delete it will return the number of rows affected.
     ** execSQL("insert into table (description) values (?)", ["Hi"]);
    */
    execSQL(sql: string, params?: [any]): Promise<any>;
    /** Get row 
     ** get('select * from table where rowid = ?', [1])
    */
    get(sql: string, params?: [any]): Promise<any>;
    /** Get rows 
     ** all('select * from table where rowid > ? and rowid < ?', [1,100])
    */
    all(sql: string, params?: [any]): Promise<any>;
    resultType(type: database);
}

export class Sqlite {

    dbName: string
    public db: DB;

    constructor(dbname?: string) {
        var me = this;
        if (dbname) me.dbOpen(dbname);
    }

    /** Open the database 
    **database will be created if it does not exist. 
    */
    public dbOpen(dbname?: string): Promise<any> {
        var me = this;
        if (dbname) me.dbName = dbname;
        return new Promise(function (resolve, reject) {
            if (!me.dbName) {
                reject("No database name");
                return;
            }
            if (me.db) {
                resolve();
                return;
            }
            new sqlite(me.dbName).then((db: DB) => {
                me.db = db;
                me.db.resultType(database.ResultsAsObject);
                resolve();
                return;
                //                return me.version();
                //            }).then((version: number) => {
                //                if (version == 0) return me.createTables();
                //                resolve();
            }).catch((err) => {
                var error = new Error(`Failed to open database (${me.dbName}. ${err}`);
                reject(error);
            });

        });
    }

    /** Overloadable function to create the database */
    public createTables(): Promise<any> {
        var me = this;
        return new Promise(function (resolve, reject) {
            resolve();
        });
    }

    /** True if the database exists in the App/OS Database folder */
    public exists(dbname: string): boolean {
        return sqlite.exists();
    }

    /** Delete the database */
    public deleteDatabase(dbname: string) {
        sqlite.deleteDatabase();
    }

    /** Used for "update", "insert", "delete" and any other sqlite command where you are not expecting a result set back. 
    ** If this is an Insert it will return the last row id of the new inserted record. 
    ** If it is an update/delete it will return the number of rows affected.
    ** execSQL("insert into table (description) values (?)", ["Hi"]);
    */
    public execute(sql: string, params?: [any]): Promise<any> {
        var me = this;
        return me.db.execSQL(sql, params);
    }

    /** Get row 
     ** fetch('select * from table where rowid = ?', [1])
    */
    public fetch(sql: string, params?: [any]): Promise<any> {
        var me = this;
        return me.db.get(sql, params);
    }

    /** Get rows 
     ** select('select * from table where rowid > ? and rowid < ?', [1,100])
    */
    public select(sql: string, params?: [any]): Promise<any> {
        var me = this;
        return me.db.all(sql, params);
    }

    /** Get/Set version */
    public version(version?: number): Promise<number> {
        var me = this;
        return me.db.version(version);
    }
    /** Is the current database open true/false */
    public isopen(): boolean {
        var me = this;
        return me.db.isopen();
    }
    /** Closes the database */
    public close(): Promise<any> {
        var me = this;
        return me.db.close();
    }


    /** Check if table exists */
    public tableExists(tableName: string): Promise<boolean> {
        var me = this;
        return new Promise(function (resolve, reject) {
            me.fetch("select * from sqlite_master where type = 'table' and name = ?", [tableName]).then((data) => {
                resolve(!!data);
            }).catch((error: Error) => {
                alert(error.message);
                reject(error);
            });
        });
    }

}

export class BaseEntity {

    private sqlite: Sqlite;
    private dbname = "messenger.db";
    private isOpen = false;

    /** The name of the primary key column in the database */
    primaryKeyColumn: string = "rowid";
    /** The column in the table that is the primary description column (defaults to description) */
    descriptionColumn: string = "description";
    /** A buffer containing a single table row */
    row = {};
    /** A copy of the row */
    baseRow: Object;
    /** An array of rows */
    rows = [];
    /** Total number of rows in the table */
    totalRows = 0;
    /** The start row number */
    startRow: number = 0;
    /** End of File reached*/
    eof: boolean = false;
    /** Number of rows to fetch*/
    pageSize: number = 30;
    //** script to create table */
    createScriptColumns: string = '';

    private _table: string;
    /** The name of the table */
    public get table(): string { return this._table }
    public set table(table: string) { this._table = table; }

    /** An array of columns that exist in the database */
    public get dbColumns(): string[] { return Object.keys(this.baseRow) }

    constructor(dbname?: string) {
        var me = this;
        me.sqlite = new Sqlite(dbname);
    }


    open(): Promise<any> {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (me.isOpen) {
                resolve();
                return;
            }
            me.sqlite = new Sqlite();
            me.sqlite.dbOpen(me.dbname).then(() => {
                return me.sqlite.tableExists(me.table);
            }).then((isExists) => {
                if (!isExists) return me.createTable();
            }).then(() => {
                me.isOpen = true;
                resolve();
            }).catch((error: Error) => {
                alert(error.message);
                reject(error);
            });
        });
    }

    createTable(): Promise<number> {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!me.createScriptColumns) {
                resolve();
                return;
            }
            var sql = `CREATE TABLE ${me.table} (${me.createScriptColumns})`;
            //      me.sqlite.execute(, [, me.createScriptColumns]).then((data) => {
            me.sqlite.execute(sql).then((data) => {
                resolve();
            }).catch((error: Error) => {
                alert(error.message);
                reject(error);
            });
        });
    }

    /** Fetch rows from the database and place them in the entities rows array */
    public fetchRows(fetchOption?: FetchOptions) : Promise<any[]> {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!fetchOption) fetchOption = {};

            //If there is already data in the rows array, just return that data
            if (fetchOption.useCache && me.rows.length != 0 && fetchOption.action == "None") {
                resolve(me.rows);
                return;
            }

            if (fetchOption.usePaging) {
                if (fetchOption.action == "Refresh") me.rows = [];
                if (!fetchOption.limit) fetchOption.limit = me.pageSize;
                if (!fetchOption.offset) fetchOption.offset = me.startRow + me.rows.length;
                fetchOption.total = true;
            }

            var sql = `select ${fetchOption.columns || me.primaryKeyColumn + ", *"} from ${me.table}`;
            if (fetchOption.where) sql += ` where ${fetchOption.where}`;
            if (fetchOption.order) sql += ` order by ${fetchOption.order}`;
            if (fetchOption.offset) sql += ` offset ${fetchOption.offset}`;
            if (fetchOption.limit) sql += ` limit ${fetchOption.limit}`;
            me.open().then(() => {
                return me.sqlite.select(sql);
            }).then((data) => {
                me.eof = true;
                me.rows = data;
                resolve(data);
            }).catch(function (error) {
                reject(error);
            });
        });
    };

    /** Fetch a row from the database and place it in the entities row object. If you leave the recordid blank it will try use the recordid from the row array */
    public fetchRow(recordId?: number): Promise<any> {
        var me = this;
        if (!recordId && me.row) recordId = me.row[me.primaryKeyColumn];
        return new Promise(function (resolve, reject) {
            if (!recordId) {
                resolve(me.row);
                return;
            }
            me.open().then(() => {
                var sql = `select ${me.primaryKeyColumn}, * from ${me.table} where ${me.primaryKeyColumn} = ${recordId}`
                return me.sqlite.fetch(sql);
            }).then((data) => {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error(`Error fetching (${recordId}) from ${me.table}. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** Fetch a row from the database and place it in the entities row object.
     ** If you leave the column blank it will use the description column;
     */
    public fetchRowByColumn(value: string, column?: string, option?: "equals" | "like" | "startswith"): Promise<any> {
        var me = this;
        if (!column) column = me.descriptionColumn;
        return new Promise(function (resolve, reject) {
            if (!value || value == undefined) {
                me.row = {}
                resolve(me.row);
                return;
            }
            me.open().then(() => {
                var sql: string;
                switch (option) {
                    case "like":
                        value = "'%" + value.replace(/'/g, "''") + "%'";
                        sql = `select ${me.primaryKeyColumn}, * from ${me.table} where ${column} like ${value}`
                        break;
                    case "startswith":
                        value = "'%" + value.replace(/'/g, "''") + "'";
                        sql = `select ${me.primaryKeyColumn}, * from ${me.table} where ${column} like ${value}`
                        break;
                    default:
                        value = "'" + value.replace(/'/g, "''") + "'";
                        sql = `select ${me.primaryKeyColumn}, * from ${me.table} where ${column} = ${value}`
                }
                return me.sqlite.fetch(sql);
            }).then((data) => {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error(`Error fetching row where (${column} = ${value}) from ${me.table}. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };


    /** Fetch a row from the database and place it in the entities row object. If you leave the recordid blank it will try use the recordid from the row array */
    public fetchRowBySql(sql: string): Promise<any> {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!sql) {
                resolve({});
                return;
            }
            me.open().then(() => {
                return me.sqlite.fetch(sql);
            }).then((data) => {
                me.row = data || {};
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error(`Error fetching rowid column from ${me.table}. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** Fetch a rows id using the decription column */
    public fetchRowId(description: string): Promise<number> {
        var me = this;
        return new Promise(function (resolve, reject) {
            if (!description) {
                resolve(0);
                return;
            }
            var value = "'" + description.replace(/'/g, "''") + "'";
            me.open().then(() => {
                var sql = `select ${me.primaryKeyColumn} from ${me.table} where ${me.descriptionColumn} = ${value}`
                return me.sqlite.fetch(sql);
            }).then((data) => {
                if (!data) data = {};
                me.row[me.primaryKeyColumn] = data.rowid || 0;
                resolve(me.row[me.primaryKeyColumn]);
            }).catch(function (err) {
                var error = new Error(`Error fetching rowid for (${description}) from ${me.table}. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** Fetch a rowid from the database by alternate column. */
    public fetchRowIdByColumn(value: string, column?: string, option?: "equals" | "like" | "startswith"): Promise<number> {
        var me = this;
        if (!column) column = me.descriptionColumn;
        return new Promise(function (resolve, reject) {
            if (!value || value == undefined) {
                me.row = {}
                resolve(0);
                return;
            }
            me.open().then(() => {
                var sql: string;
                switch (option) {
                    case "like":
                        value = "'%" + value.replace(/'/g, "''") + "%'";
                        sql = `select ${me.primaryKeyColumn} from ${me.table} where ${column} like ${value}`
                        break;
                    case "startswith":
                        value = "'%" + value.replace(/'/g, "''") + "'";
                        sql = `select ${me.primaryKeyColumn} from ${me.table} where ${column} like ${value}`
                        break;
                    default:
                        value = "'" + value.replace(/'/g, "''") + "'";
                        sql = `select ${me.primaryKeyColumn} from ${me.table} where ${column} = ${value}`
                }
                return me.sqlite.fetch(sql);
            }).then((data) => {
                if (!data) data = {};
                me.row[me.primaryKeyColumn] = data.rowid || 0;
                resolve(me.row[me.primaryKeyColumn]);
            }).catch(function (err) {
                var error = new Error(`Error fetching rowid for (${column}) from ${me.table}. ${err}`);
                alert(error.message);
                reject(error);
            });

        });
    };


    /** Fetch rows from the database and place them in the entities rows array */
    public fetchList(listView: listViewModule.RadListView, fetchOption?: FetchOptions): Promise<any[]> {
        var me = this;
        listView.focus();

        return new Promise(function (resolve, reject) {
            me.fetchRows(fetchOption).then(function (data: any[]) {
                if (fetchOption.action == "Refresh") listView.items.splice(0);
                listView.items.push.apply(listView.items, data);
                listView.loadOnDemandMode = me.eof
                    ? ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.None]
                    : ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.Auto];
                if (fetchOption.action == "Refresh" || fetchOption.action == "LoadPrevious") listView.notifyPullToRefreshFinished();
                if (fetchOption.action == "LoadMore") listView.notifyLoadOnDemandFinished();
                resolve(data);
            }).catch(function (err) {
                listView.loadOnDemandMode = ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.None]
                if (fetchOption.action == "Refresh" || fetchOption.action == "LoadPrevious") listView.notifyPullToRefreshFinished();
                if (fetchOption.action == "LoadMore") listView.notifyLoadOnDemandFinished();
                alert(err.message);
                reject(err);
            });
        });
    }

    /** Fetch rows from the database and place them in the entities rows array */
    public radList(data: any[], listView: listViewModule.RadListView, fetchOption?: FetchOptions): Promise<any[]> {
        var me = this;
        listView.focus();
        return new Promise(function (resolve, reject) {
            if (!fetchOption.usePaging) me.eof = true;
            if (fetchOption.action == "Refresh") listView.items.splice(0);
            listView.items.push.apply(listView.items, data);
            listView.loadOnDemandMode = me.eof
                ? ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.None]
                : ListViewLoadOnDemandMode[ListViewLoadOnDemandMode.Auto];
            if (fetchOption.action == "Refresh" || fetchOption.action == "LoadPrevious") listView.notifyPullToRefreshFinished();
            if (fetchOption.action == "LoadMore") listView.notifyLoadOnDemandFinished();
            resolve(data);
        });
    }


    public saveRow(row?: object): Promise<any> {
        var me = this;
        if (me.row[me.primaryKeyColumn]) { //update
            return me.updateRow(row);
        } else {
            return me.insertRow(row);
        }
    };

    /** insert a row*/
    public insertRow(row?: object): Promise<any> {
        var me = this;
        return new Promise(function (resolve, reject) {

            row = me.getSanitisedColumns(row || me.row);

            var columns = [];
            var values = [];
            for (var key in row) {
                if (!row.hasOwnProperty(key)) continue;
                if (key == me.primaryKeyColumn) continue;
                var value = row[key];
                if (value == undefined) value = '';
                if (typeof (value) == "object") value = JSON.stringify(value);
                if (typeof (value) == "string" && value != "null") value = "'" + <string>value.replace(/'/g, "''") + "'";
                columns.push(key);
                values.push(value);
            }
            if (columns.length == 0) {
                var error = new Error(`Error adding ${me.table} data. No columns suppiled`);
                alert(error.message);
                reject(error);
                return;
            }
            var sql = `insert into ${me.table} (${columns.join()}) values(${values.join()})`;
            me.open().then(() => {
                return me.sqlite.execute(sql)
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function (rowid: number) {
                me.row = row;
                me.row[me.primaryKeyColumn] = rowid;
                resolve(me.row);
            }).catch(function (err) {
                var error = new Error(`Error adding ${me.table} data. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** update a row*/
    public updateRow(row?: object): Promise<any> {
        var me = this;
        return new Promise(function (resolve, reject) {

            row = me.getSanitisedColumns(row || me.row);
            if (!row) {
                resolve();
                return;
            }
            var columns = [];
            for (var key in row) {
                if (!row.hasOwnProperty(key)) continue;
                if (key == me.primaryKeyColumn) continue;
                var value = <string>row[key];
                if (typeof (value) == "object") value = JSON.stringify(value);
                if (typeof (value) == "string") value = "'" + <string>value.replace(/'/g, "''") + "'";
                columns.push(`${key} = ${value}`);
            }
            var sql = `update ${me.table} set ${columns.join()} where ${me.primaryKeyColumn} = ${row[me.primaryKeyColumn]}`;
            me.open().then(() => {
                return me.sqlite.execute(sql)
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function (rowid: number) {
                me.row = row;
                resolve(row);
            }).catch(function (err) {
                var error = new Error(`"Error updating ${me.table} data. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** update a column
     ** The corresponding row item will be updated too 
     ** Leaving value blank will use the rows value
     ** where: use an alternate where clause
    */
    public updateColumn(rowid, column, value?): Promise<string | number> {
        var me = this;
        if (!rowid || rowid == undefined || !column || column == undefined) {
            return new Promise(function (resolve, reject) {
                resolve(value);
                return;
            });
        }
        var where = `${me.primaryKeyColumn} = ${rowid}`;
        return me.updateColumnWhere(column, value, where);
    }

    public updateColumnWhere(column, value, where: string): Promise<string | number> {
        var me = this;
        if (value == undefined) value = me.row[column];

        return new Promise(function (resolve, reject) {
            if (!where) {
                me.row[column] = value;
                resolve(value);
                return;
            }
            var colValue = typeof (value) == "string" ? "'" + <string>value.replace(/'/g, "''") + "'" : value;
            var sql = `update ${me.table} set ${column} = ${colValue} where ${where}`;
            me.open().then(() => {
                return me.sqlite.execute(sql)
            }).then(function (affected: number) {
                me.row[column] = value;
                resolve(value);
            }).catch(function (err) {
                var error = new Error(`"Error updating ${me.table} data. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** update a column
    ** The corresponding row item will be updated too 
   */
    public updateColumns(rowid: number, columns: object): Promise<any> {
        var me = this;
        return new Promise(function (resolve, reject) {


            var columnsArray = [];
            for (var key in columns) {
                if (!columns.hasOwnProperty(key)) continue;
                if (key == me.primaryKeyColumn) continue;
                var value = <string>columns[key];
                if (typeof (value) == "object") value = JSON.stringify(value);
                if (typeof (value) == "string") value = "'" + <string>value.replace(/'/g, "''") + "'";
                columnsArray.push(`${key} = ${value}`);
            }
            if (!rowid || rowid == undefined || columnsArray.length == 0) {
                resolve();
                return;
            }
            var sql = `update ${me.table} set ${columnsArray.join()} where ${me.primaryKeyColumn} = ${rowid}`;
            me.open().then(() => {
                return me.sqlite.execute(sql)
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function () {
                me.row[me.primaryKeyColumn] = rowid;
                for (var key in columns) {
                    if (!columns.hasOwnProperty(key)) continue;
                    me.row[key] = columns[key];
                }
                resolve(columns);
            }).catch(function (err) {
                var error = new Error(`"Error updating ${me.table} data. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };


    /** delete a row */
    public deleteRow(rowid?: number) {
        var me = this;
        return new Promise(function (resolve, reject) {

            rowid = rowid || me.row[me.primaryKeyColumn];

            var sql = `delete from ${me.table} where ${me.primaryKeyColumn} = ${rowid}`;
            me.open().then(() => {
                return me.sqlite.execute(sql)
                //            me.sqlite.execute(, [me.table, columns.join(), values.join()])
            }).then(function (rowid: number) {
                resolve(rowid);
                me.row[me.primaryKeyColumn] = rowid;
            }).catch(function (err) {
                var error = new Error(`"Error deleting ${me.table} data. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };


    /** execute a sql function */
    public execute(sql: string) {
        var me = this;
        return new Promise(function (resolve, reject) {

            me.open().then(() => {
                return me.sqlite.execute(sql);
            }).then(function (rowid: number) {
                resolve();
            }).catch(function (err) {
                var error = new Error(`"Error executing script. ${err}`);
                alert(error.message);
                reject(error);
            });
        });
    };

    /** clean data, removing columns that are not in the entities database columns */
    public getSanitisedColumns(row) {
        var me = this;
        var dbRow = {};
        for (var col in row) {
            var colName = col.toLowerCase();
            if (me.dbColumns.indexOf(colName) != -1) dbRow[colName] = row[colName];
        }
        return dbRow;
    }
}


