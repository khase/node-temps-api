var express = require('express');
var app = express();

var path = require('path');
var fs=require('fs');

var util = require('util');

var bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

var mysql = require('mysql');
var con = mysql.createConnection({
  host: process.env.MYSQL_HOST || "mysql",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || process.env.MYSQL_ROOT_PASSWORD || ""
});
const dbName = process.env.MYSQL_DATABASE || "esp";
const tableNameTimestamps = "timestamps";
const tableSQLTimestamps = "CREATE TABLE IF NOT EXISTS `" + dbName + "`.`" + tableNameTimestamps + "` ( `timestamp` INT NOT NULL, `dateTime` DATETIME NULL, `year` INT NULL, `month` INT NULL, `day` INT NULL, `dayOfWeek` INT NULL, `week` INT NULL, `hour` INT NULL, `minute` INT NULL, `second` INT NULL, PRIMARY KEY (`timestamp`)) ENGINE = InnoDB;";
const tableNameTypes = "types";
const tableSQLTypes = "CREATE TABLE IF NOT EXISTS `" + dbName + "`.`" + tableNameTypes + "` ( `id` INT NOT NULL, `name` VARCHAR(45) NULL, `unit` VARCHAR(45) NULL, PRIMARY KEY (`id`)) ENGINE = InnoDB;";
const tableFixturesTypes = "INSERT INTO `" + dbName + "`.`" + tableNameTypes + "` (`id`, `name`, `unit`) VALUES ('0', 'Lufttemperatur', '°C'),('1', 'Luftfeuchtigkeit', '%'),('2', 'Wassertemperatur', '°C'),('3', 'Batterie', 'Volt');";
const tableNameData = "data";
const tableSQLData = "CREATE TABLE IF NOT EXISTS `" + dbName + "`.`" + tableNameData + "` ( `id` INT NOT NULL AUTO_INCREMENT, `timestamp` INT NULL, `type` INT NULL, `value` FLOAT NULL, PRIMARY KEY (`id`), INDEX `fk_data_timestamps_idx` (`timestamp` ASC), INDEX `fk_data_types1_idx` (`type` ASC), CONSTRAINT `fk_data_timestamps`   FOREIGN KEY (`timestamp`)   REFERENCES `" + dbName + "`.`" + tableNameTimestamps + "` (`timestamp`)   ON DELETE NO ACTION   ON UPDATE NO ACTION, CONSTRAINT `fk_data_types1`   FOREIGN KEY (`type`)   REFERENCES `" + dbName + "`.`" + tableNameTypes + "` (`id`)   ON DELETE NO ACTION   ON UPDATE NO ACTION) ENGINE = InnoDB;";

//TODO: pass this value with get request
const timeZoneCorrection = 7200;
const generalSQL = "SELECT DATE_FORMAT(FROM_UNIXTIME(`" + tableNameData + "`.timestamp), \"%Y.%m.%d %H:00\") as date, `" + tableNameTypes + "`.name, `" + tableNameData + "`.value, `" + tableNameTypes + "`.unit FROM (SELECT MIN(timestamp) + " + timeZoneCorrection + " as timestamp, type, ROUND(AVG(value), 2) as value FROM `" + dbName + "`.`" + tableNameData + "` WHERE `" + dbName + "`.`" + tableNameData + "`.timestamp < UNIX_TIMESTAMP() AND `" + dbName + "`.`" + tableNameData + "`.timestamp > 1500000000 GROUP BY `" + dbName + "`.`" + tableNameData + "`.timestamp div 3600, `" + dbName + "`.`" + tableNameData + "`.type) AS `" + tableNameData + "` JOIN `" + dbName + "`.`" + tableNameTypes + "` ON `" + dbName + "`.`" + tableNameTypes + "`.id = `" + tableNameData + "`.type ORDER BY `" + tableNameData + "`.timestamp desc ";
const todaySQL = "SELECT DATE_FORMAT(FROM_UNIXTIME(`" + tableNameData + "`.timestamp), \"%Y.%m.%d %H:%i\") as date, `" + tableNameTypes + "`.name, `" + tableNameData + "`.value, `" + tableNameTypes + "`.unit FROM (SELECT MIN(timestamp) + " + timeZoneCorrection + " as timestamp, type, ROUND(AVG(value), 2) as value FROM `" + dbName + "`.`" + tableNameData + "` WHERE `" + dbName + "`.`" + tableNameData + "`.timestamp < UNIX_TIMESTAMP() AND `" + dbName + "`.`" + tableNameData + "`.timestamp > UNIX_TIMESTAMP() - time_to_sec(NOW()) - " + timeZoneCorrection + " GROUP BY `" + dbName + "`.`" + tableNameData + "`.timestamp div 900, `" + dbName + "`.`" + tableNameData + "`.type) AS `" + tableNameData + "` JOIN `" + dbName + "`.`" + tableNameTypes + "` ON `" + dbName + "`.`" + tableNameTypes + "`.id = `" + tableNameData + "`.type ORDER BY `" + tableNameData + "`.timestamp desc";

app.post('/', function(req, res) {
  res.send("{success: true}");
  var timestamp = new Date(req.body.t * 1000);
  pad = function(num) {
            var norm = Math.abs(Math.floor(num));
            return (norm < 10 ? '0' : '') + norm;
        };
  var dateTime = timestamp.getFullYear() +
        '-' + pad(timestamp.getMonth() + 1) +
        '-' + pad(timestamp.getDate()) +
        'T' + pad(timestamp.getHours()) +
        ':' + pad(timestamp.getMinutes()) +
        ':' + pad(timestamp.getSeconds());

  var timestampSQL = "INSERT INTO `" + dbName + "`.`" + tableNameTimestamps + "` " + 
            "(`timestamp`, `dateTime`, `year`, `month`, `day`, `dayOfWeek`, `week`, `hour`, `minute`, `second`)" + 
            "VALUES ('" + 
            req.body.t + "', '" + 
            dateTime + "', '" + 
            timestamp.getFullYear() + "', '" + 
            (timestamp.getMonth() + 1) + "', '" + 
            timestamp.getDate() + "', '" + 
            (timestamp.getDay() + 1) + "', '" + 
            getWeekNumber(timestamp)[1] + "', '" + 
            timestamp.getHours() + "', '" + 
            timestamp.getMinutes() + "', '" + 
            timestamp.getSeconds() + "');";
  con.query(timestampSQL, function (err, result) {});

  var dataSQL = "INSERT INTO `" + dbName + "`.`" + tableNameData + "` " + 
            "(`timestamp`, `type`, `value`) " + 
            "VALUES " + 
            "('" + req.body.t + "', '0', '" + req.body.a + "'), " +
            "('" + req.body.t + "', '1', '" + req.body.h + "'), " +
            "('" + req.body.t + "', '2', '" + req.body.w + "'), " +
            "('" + req.body.t + "', '3', '" + req.body.b + "')";
  con.query(dataSQL, function (err, result) {});
});

app.get('/', function(req, res) {
  res.send("esp temps api");
});

app.get('/timestamps', function(req, res) {
  con.query("SELECT * FROM `" + dbName + "`.`" + tableNameTimestamps + "`", function (err, result, fields) {
    if (err) throw err;
    res.send(result);
  });
});

app.get('/types', function(req, res) {
  con.query("SELECT * FROM `" + dbName + "`.`" + tableNameTypes + "`", function (err, result, fields) {
    if (err) throw err;
    res.send(result);
  });
});

app.get('/data/today', function(req, res) {
    con.query(todaySQL, function (err, result, fields) {
        if (err) throw err;
        res.send(result);
    });
});

app.get('/data/all', function(req, res) {
    con.query(generalSQL, function (err, result, fields) {
        if (err) throw err;
        res.send(result);
    });
});

app.get('/data', function(req, res) {
  con.query("SELECT * FROM `" + dbName + "`.`" + tableNameData + "`", function (err, result, fields) {
    if (err) throw err;
    res.send(result);
  });
});

app.get('/ota', function(req, res) {
    var firmware = findFirmware(req.headers['x-esp8266-version']);

    console.log("Update Request from " +
        req.headers['x-esp8266-sta-mac'] + " (" +
        req.headers['x-esp8266-sketch-size'] + " bytes used / " +
        req.headers['x-esp8266-free-space'] + " bytes free) Version: " +
        req.headers['x-esp8266-version'])

    if (!firmware) {
        res.status(304);
        res.send('No update found');
        return;
    }

    res.status(200);
    res.sendFile(__dirname + "/" + firmware);
});

var server = app.listen(80, function () {
  var host = server.address().address;
  var port = server.address().port;
    
  con.connect(function(err) {
    if (err) throw err;
    console.log("Database connected!");

    con.query("CREATE DATABASE IF NOT EXISTS `" + dbName + "`", function (err, result) {
      if (err) throw err;
      if (result.warningCount == 0) {
        console.log("Created Database");
      }
    });
    con.query(tableSQLTimestamps, function (err, result) {
      if (err) throw err;
      if (result.warningCount == 0) {
        console.log("Created Table: " + tableNameTimestamps);
}
    });
    con.query(tableSQLTypes, function (err, result) {
      if (err) throw err;
      if (result.warningCount == 0) {
        console.log("Created Table: " + tableNameTypes);
        con.query(tableFixturesTypes, function (err, result) {
          if (err) throw err;
          if (result.warningCount == 0) {
            console.log("Created Fixtures: " + tableNameTypes);
        }
    });

       }
    });
    con.query(tableSQLData, function (err, result) {
      if (err) throw err;
      if (result.warningCount == 0) {
        console.log("Created Table: " + tableNameData);
      }
    });
  });
   
  console.log("App listening at http://%s:%s", host, port);
})

function findFirmware(oldVersion){
    var startPath = "firmwares";
    var filter = ".bin";

    if (!fs.existsSync(startPath)){
        console.log("no dir ",startPath);
        return;
    }

    var files=fs.readdirSync(startPath);
    for(var i=0;i<files.length;i++){
        var filename=path.join(startPath,files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()){
            fromDir(filename,filter); //recurse
        }
        else if (filename.indexOf(filter)>=0) {
            if (filename.indexOf(oldVersion + "->") >= 0) {
                return filename;
            }
        };
    };
};

function pad (num) {
  var norm = Math.abs(Math.floor(num));
  return (norm < 10 ? '0' : '') + norm;
};

function getWeekNumber(d) {
  // Copy date so don't modify original
  d = new Date(+d);
  d.setHours(0,0,0,0);
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  d.setDate(d.getDate() + 4 - (d.getDay()||7));
  // Get first day of year
  var yearStart = new Date(d.getFullYear(),0,1);
  // Calculate full weeks to nearest Thursday
  var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
  // Return array of year and week number
  return [d.getFullYear(), weekNo];
}

function splice(string, idx, rem, str) {
    return string.slice(0, idx) + str + string.slice(idx + Math.abs(rem));
};