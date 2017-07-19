var express = require('express');
var app = express();

var util = require('util');

var bodyParser = require('body-parser');
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

var mysql = require('mysql');
var con = mysql.createConnection({
  host: "mysql",
  user: "root",
  password: "aids"
});
const dbName = "esp";
const tableNameTimestamps = "timestamps";
const tableSQLTimestamps = "CREATE TABLE IF NOT EXISTS `" + dbName + "`.`" + tableNameTimestamps + "` ( `timestamp` INT NOT NULL, `dateTime` DATETIME NULL, `year` INT NULL, `month` INT NULL, `day` INT NULL, `dayOfWeek` INT NULL, `week` INT NULL, `hour` INT NULL, `minute` INT NULL, `second` INT NULL, PRIMARY KEY (`timestamp`)) ENGINE = InnoDB;"
const tableNameTypes = "types";
const tableSQLTypes = "CREATE TABLE IF NOT EXISTS `" + dbName + "`.`" + tableNameTypes + "` ( `id` INT NOT NULL, `name` VARCHAR(45) NULL, `unit` VARCHAR(45) NULL, PRIMARY KEY (`id`)) ENGINE = InnoDB;"
const tableFixturesTypes = "INSERT INTO `" + dbName + "`.`" + tableNameTypes + "` (`id`, `name`, `unit`) VALUES ('0', 'Lufttemperatur', '°C'),('1', 'Luftfeuchtigkeit', '%'),('2', 'Wassertemperatur', '°C');";
const tableNameData = "data";
const tableSQLData = "CREATE TABLE IF NOT EXISTS `" + dbName + "`.`" + tableNameData + "` ( `id` INT NOT NULL AUTO_INCREMENT, `timestamp` INT NULL, `type` INT NULL, `value` FLOAT NULL, PRIMARY KEY (`id`), INDEX `fk_data_timestamps_idx` (`timestamp` ASC), INDEX `fk_data_types1_idx` (`type` ASC), CONSTRAINT `fk_data_timestamps`   FOREIGN KEY (`timestamp`)   REFERENCES `" + dbName + "`.`" + tableNameTimestamps + "` (`timestamp`)   ON DELETE NO ACTION   ON UPDATE NO ACTION, CONSTRAINT `fk_data_types1`   FOREIGN KEY (`type`)   REFERENCES `" + dbName + "`.`" + tableNameTypes + "` (`id`)   ON DELETE NO ACTION   ON UPDATE NO ACTION) ENGINE = InnoDB;"


const joinSQPpart = "join `" + dbName + "`.`" + tableNameTypes + "` on `" + 
                      dbName + "`.`" + tableNameData + "`.type = `" + dbName + "`.`" + tableNameTypes + "`.id " + 
                    "join `" + dbName + "`.`" + tableNameTimestamps + "` on `" + 
                      dbName + "`.`" + tableNameData + "`.timestamp = `" + dbName + "`.`" + tableNameTimestamps + "`.timestamp";
const groupSQLpartOLD = "group by `" + 
                      dbName + "`.`" + tableNameData + "`.type, `" + 
                      dbName + "`.`" + tableNameTimestamps + "`.year, `" + 
                      dbName + "`.`" + tableNameTimestamps + "`.month, `" + 
                      dbName + "`.`" + tableNameTimestamps + "`.day, `" + 
                      dbName + "`.`" + tableNameTimestamps + "`.hour, `" + 
                      dbName + "`.`" + tableNameTimestamps + "`.minute div 5";
const groupSQLpart = "group by `" + 
                      dbName + "`.`" + tableNameData + "`.type, `" + 
                      dbName + "`.`" + tableNameTimestamps + "`.timestamp div 300";
const orderSQLpart = "order by `" + dbName + "`.`" + tableNameData + "`.timestamp desc";

const joinedSQL = "SELECT dateTime, name, avg(value) as value, unit FROM `" + dbName + "`.`" + tableNameData + "` " + joinSQPpart + " " + groupSQLpart + " " + orderSQLpart;
const maxAgeSQL = "Select dateTime, name, value from (SELECT `" + dbName + "`.`" + tableNameData + "`.timestamp, dateTime, name, avg(value) as value, unit FROM `" + dbName + "`.`" + tableNameData + "` " + joinSQPpart + " " + groupSQLpart + " " + orderSQLpart + ") as tmp where tmp.timestamp < unix_timestamp() - 59 and tmp.timestamp > unix_timestamp() - "

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
            "('" + req.body.t + "', '2', '" + req.body.w + "')";
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

app.get('/data/joined/:maxage', function(req, res) {
  if (!req.params.maxage) {
    res.send("{success: false}");
  }

  con.query(maxAgeSQL + req.params.maxage, function (err, result, fields) {
    if (err) throw err;
    res.send(result);
  }); 
});

app.get('/data/joined', function(req, res) {
  con.query(joinedSQL, function (err, result, fields) {
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