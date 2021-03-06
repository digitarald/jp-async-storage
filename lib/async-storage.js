let self = require('sdk/self');
let { indexedDB, IDBKeyRange } = require('sdk/indexed-db');
let { setTimeout } = require('sdk/timers');

var database = {};

database.onerror = function(e) {
  console.error(e);
};

function open(config, callback) {
  var request = indexedDB.open(config.name, config.version);

  request.onupgradeneeded = function(e) {
    var db = e.target.result;
    e.target.transaction.onerror = database.onerror;

    if(db.objectStoreNames.contains("items")) {
      db.deleteObjectStore("items");
    }
    var store = db.createObjectStore("items");
  };

  request.onsuccess = function(e) {
    database.db = e.target.result;
    callback(null, "database initialized...");
  };

  request.onerror = function(e) {
    callback(e.value);
  };
}

function setItem(key, value, callback) {
  let db = database.db;
  let trans = db.transaction(["items"], "readwrite");
  let store = trans.objectStore("items");
  let time = new Date().getTime();
  let request = store.put(value, key);

  trans.oncomplete = function(event) {
    callback(null, event.value);
  };

  request.onerror = function(e) {
    callback(e.value);
  };
}

function getItem(key, callback) {
  let cb = callback;
  let db = database.db;
  let trans = db.transaction(["items"], "readwrite");
  let store = trans.objectStore("items");
  let request = store.get(key);
  request.onsuccess = function(event) {
    callback(null, event.target.result);
  };

  request.onerror = function(event) {
    callback(event.value);
  };
}

function getItems(callback) {
  let db = database.db;
  let trans = db.transaction(["items"], "readwrite");
  let store = trans.objectStore("items");
  let items = [];

  trans.oncomplete = function() {
    callback(null, items);
  };

  let keyRange = IDBKeyRange.lowerBound(0);
  let cursorRequest = store.openCursor(keyRange);

  cursorRequest.onsuccess = function(e) {
    var result = e.target.result;
    if (!result) {
      return;
    }
    items.push(result.value);
    result.continue();
  };

  cursorRequest.onerror = function(e) {
    callback(e);
  };
}

function removeItem(key, callback) {
  let db = database.db;
  let trans = db.transaction(["items"], "readwrite");
  let store = trans.objectStore("items");
  let req = store.delete(key);
  req.onsuccess = function() {
    callback(null, true);
  };

  req.onerror = function() {
    callback(req.error);
  };

  req.onabort = function(event) {
    let error = event.target.error;
    if (error === 'QuotaExceededError') {
      callback(error);
    }
  };
}


function clear(callback) {
  let db = database.db;
  let store = db.transaction(["items"], 'readwrite').objectStore("items");
  let req = store.clear();

  req.onsuccess = function() {
    deferCallback(callback);
  };

  req.onerror = function() {
    if (callback) {
      callback(null, req.error);
    }
  };
}

function key(n, callback) {
  let db = database.db;
  let store = db.transaction(["items"], "readonly").objectStore("items");
  let advanced = false;
  let req = store.openCursor();
  req.onsuccess = function() {
    let cursor = req.result;
    if (!cursor) {
      // this means there weren't enough keys
      if (callback) {
        callback(null);
      }
    }

    if (n === 0) {
      // We have the first key, return it if that's what they
      // wanted.
      if (callback) {
        callback(null, cursor.key);
      }
    } else {
      if (!advanced) {
        // Otherwise, ask the cursor to skip ahead n
        // records.
        advanced = true;
        cursor.advance(n);
      } else {
        // When we get here, we've got the nth key.
        if (callback) {
          callback(null, cursor.key);
        }
      }
    }
  };

  req.onerror = function() {
    if (callback) {
      callback(null, req.error);
    }

    reject(req.error);
  };
}

function keys(callback) {
  let db = database.db;
  let store = db.transaction(["items"], 'readonly').objectStore("items");
  let req = store.openCursor();
  let _keys = [];

  req.onsuccess = function() {
    let cursor = req.result;

    if (!cursor) {
      if (callback) {
        callback(null, _keys);
      }
      return;
    }

    _keys.push(cursor.key);
    cursor.continue();
  };

  req.onerror = function() {
    if (callback) {
      callback(req.error);
    }
  };
}

function deferCallback(callback, value) {
  if (callback) {
    return setTimeout(function() {
      return callback(value);
    }, 0);
  }
}

function length(callback) {
  let db = database.db;
  let store = db.transaction(["items"], 'readonly')
    .objectStore("items");
  let req = store.count();

  req.onsuccess = function() {
    if (callback) {
      callback(null, req.result);
    }
  };

  req.onerror = function() {
    if (callback) {
      callback(req.error);
    }
  };
}

// define the export object.
module.exports.AsyncStorage = {
  open:         open,
  setItem:      setItem,
  getItems:     getItems,
  getItem:      getItem,
  database:     database,
  removeItem:   removeItem,
  clear:        clear,
  keys:         keys,
  length:       length,
  key:          key
};
