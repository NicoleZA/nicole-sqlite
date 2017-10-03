# Sqlite

A NativeScript module providing a collection of useful functions

## Installation

```
npm install nicole-sqlite
```

### Function list


## Usage

import * as sqliteModule from "nicole-sqlite";

/** The columns as they appear in the database excluding computed columns*/
export class ContactColumns {
    rowid: number = 0;
    contactid: number = 0;
    description: string = '';
}

/** Columns including computed columns */
export class ContactRow extends ContactColumns {
}

/** Contact Class */
export class Contact extends sqliteModule.BaseEntity {

    row = new ContactRow();
    rows: Array<ContactRow>

    constructor() {
        super();
        var me = this;
        me.baseRow = new ContactColumns();
        me.table = "contact";
        me.createScriptColumns = "contactid int NOT NULL UNIQUE, description text NOT NULL"
    }

}

var contactEntities = new Contact();
contactEntities.FetchRows().then(rows=>{
    
})