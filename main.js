/**
 * comfoair adapter
 */

/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
let adapter;
var deviceIpAdress;
var port;
var net = require('net');
var DelimiterStream = require('delimiter-stream');
var StringDecoder = require('string_decoder').StringDecoder;
var hexout = [];
var buffarr = [];
var buff;


var statcmdimaster = [
  [0x07, 0xF0, 0x00, 0xD1, 0x00, 0x7E, 0x07, 0x0F], //Temperaturen
  [0x07, 0xF0, 0x00, 0xCD, 0x00, 0x7A, 0x07, 0x0F], //Ventilatorenstati
  [0x07, 0xF0, 0x00, 0xDD, 0x00, 0x8A, 0x07, 0x0F], //Betriebsstunden
  [0x07, 0xF0, 0x00, 0x0D, 0x00, 0xBA, 0x07, 0x0F], //Status Bypass
  [0x07, 0xF0, 0x00, 0xC9, 0x00, 0x76, 0x07, 0x0F], //Verzögerungen (Filterwechsel)
  [0x07, 0xF0, 0x00, 0xD9, 0x00, 0x86, 0x07, 0x0F], // Störungen/Filterwechsel
  [0x07, 0xF0, 0x00, 0x97, 0x00, 0x44, 0x07, 0x0F] //Werte Enthalpietauscher
];
var statcmdisafe = [
  [0x07, 0xF0, 0x00, 0xDD, 0x00, 0x8A, 0x07, 0x0F], //Betriebsstunden
  [0x07, 0xF0, 0x00, 0x0D, 0x00, 0xBA, 0x07, 0x0F], //Status Bypass
  [0x07, 0xF0, 0x00, 0xC9, 0x00, 0x76, 0x07, 0x0F], //Verzögerungen (Filterwechsel)
  [0x07, 0xF0, 0x00, 0xD9, 0x00, 0x86, 0x07, 0x0F] //Störungen/Filterwechsel
];
var setfanstate = [
  [0x07, 0xF0, 0x00, 0x99, 0x01, 0x01, 0x48, 0x07, 0x0F], //Stufe abwesend
  [0x07, 0xF0, 0x00, 0x99, 0x01, 0x02, 0x49, 0x07, 0x0F], //Stufe niedrig
  [0x07, 0xF0, 0x00, 0x99, 0x01, 0x03, 0x4A, 0x07, 0x0F], //Stufe mittel
  [0x07, 0xF0, 0x00, 0x99, 0x01, 0x04, 0x4B, 0x07, 0x0F] //Stufe hoch
];
var setcomfotemp = [0x07, 0xF0, 0x00, 0xD3, 0x01, 0x14, 0x48, 0x07, 0x0F]; //Komforttemperatur setzen
var setreset = [0x07, 0xF0, 0x00, 0xDB, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0x0F];
var setvent = [0x07, 0xF0, 0x00, 0xCF, 0x09, 0x0F, 0x28, 0x46, 0x0F, 0x28, 0x46, 0x5A, 0x5A, 0x00, 0x00, 0x07, 0x0F]; //Ventilatorstufen setzen
var setventlevel = ['ABLabw', 'ABL1', 'ABL2', 'ZULabw', 'ZUL1', 'ZUL2', 'ABL3', 'ZUL3'];
var setrs232 = [0x07, 0xF0, 0x00, 0x9B, 0x01, 0x02, 0x4b, 0x07, 0x0F];
var set232PCLogmode = [0x07, 0xF0, 0x00, 0x9B, 0x01, 0x04, 0x4d, 0x07, 0x0F];
var set232PCMaster = [0x07, 0xF0, 0x00, 0x9B, 0x01, 0x03, 0x4c, 0x07, 0x0F];
var setrs232cceaseonly = [0x07, 0xF0, 0x00, 0x9B, 0x01, 0x00, 0x49, 0x07, 0x0F];
var selbsttest = [0x07, 0xF0, 0x00, 0xDB, 0x04, 0x00, 0x00, 0x01, 0x00, 0x8d, 0x07, 0x0F];
var verzoegerungensoll = [0x07, 0xF0, 0x00, 0xCB, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x99, 0x07, 0x0F];
var verzoegerungen = [];
var calli = 0;
var callj = 0
var callval;
var callvals;
var safemode = false;
var cceasemode = false;
var pcmaster;
var testmaster;
var testswi;
var pclogmode = false;
var pcmastermode = false;
var enthalpie = false;
var testj = 0;
var listenonly = false;
var rs232;


let polling;

function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
    name: 'comfoair'
  });

  adapter = new utils.Adapter(options);

  // when adapter shuts down
  adapter.on('unload', function(callback) {
    try {
      clearInterval(polling);
      client.destroy();
      adapter.log.info('[END] Stopping comfoair adapter...');
      adapter.setState('info.connection', false, true);
      callback();
    } catch (e) {
      callback();
    }
  });

  // is called if a subscribed object changes
  adapter.on('objectChange', function(id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
  });

  // is called if a subscribed state changes
  adapter.on('stateChange', function(id, state) {
    // Warning, state can be null if it was deleted

    try {
      adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));
      //adapter.log.debug("Adapter=" + adapter.toString());

      if (!id || state.ack) return; // Ignore acknowledged state changes or error states
      id = id.substring(adapter.namespace.length + 1); // remove instance name and id
      state = state.val;
      adapter.log.debug("id=" + id);
      if ((cceasemode == true && id != "control.rs232mode") || listenonly == true) {
        adapter.log.warn("CC Ease only - Modus oder Abhör-Modus: Führe keine Befehle aus");
        return;
      }
      if (safemode == true) {
        adapter.log.debug("Setze RS232 auf PC Master");
        pcmaster = setTimeout(function repe() {
          callcomfoair(set232PCMaster);
          if (pcmastermode == false) {
            setTimeout(repe, 1000);
          }
        }, 500);
        testswi = setInterval(testswitchcommand, 1000, id, state); //Ueberprüfen, ob PC-Master-mode aktiv ist.

      } else {
        controlcomfoair(id, state);
      }

      // you can use the ack flag to detect if it is status (true) or command (false)
      if (state && !state.ack) {
        adapter.log.debug('ack is not set!');
      }
    } catch (e) {
      adapter.log.debug("Fehler Befehlsauswertung: " + e);
    }
  });

  // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
  adapter.on('message', function(obj) {
    if (typeof obj === 'object' && obj.message) {
      if (obj.command === 'send') {
        // e.g. send email or pushover or whatever
        adapter.log.debug('send command');

        // Send response in callback if required
        if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
      }
    }
  });

  // is called when databases are connected and adapter received configuration.
  adapter.on('ready', function() {
    if (adapter.config.host) {
      adapter.log.info('[START] Starting comfoair adapter');
      adapter.setState('info.connection', true, true);
      main();
    } else adapter.log.warn('[START] No IP-address set');
  });

  return adapter;
} // endStartAdapter


function main() {
  // Vars
  deviceIpAdress = adapter.config.host;
  port = adapter.config.port;
  pcmastermode = adapter.config.adapteronly;
  listenonly = adapter.config.listen;
  safemode = adapter.config.listencontrol;
  pclogmode = adapter.config.logmode;

  if (pcmastermode == true || safemode == true || pclogmode == true) {
    setpollingobjects();
    setcontrolobjects();
  }

  const pollingTime = adapter.config.pollInterval || 300000;
  adapter.log.info('[INFO] Configured polling interval: ' + pollingTime);
  adapter.log.debug('[START] Started Adapter with: ' + adapter.config.host);

  if (listenonly == true || safemode == true) {
    callcomfoair(setrs232cceaseonly);
    listentocomfoair();
  }

  if (pcmastermode == true) {
    pcmaster = setTimeout(function repe() {
      callcomfoair(set232PCMaster);
      if (pcmastermode == false) {
        setTimeout(repe, 1000);
      }
    }, 500);

    testmaster = setInterval(test, 1000); //Ueberprüfen, ob PC-Master-mode aktiv ist.
  }

  if (pclogmode == true) {
    pcmaster = setTimeout(function repe() {
      callcomfoair(set232PCLogmode);
      if (pclogmode == false) {
        setTimeout(repe, 1000);
      }
    }, 500);

    testmaster = setInterval(test, 1000); //Ueberprüfen, ob PC-Master-mode aktiv ist.
  }

  if (!polling) {
    if (pcmastermode == true || pclogmode == true) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds
        callval = setInterval(callvaluespcmaster, 2000); //DATAREQUEST;
        setTimeout(repeat, pollingTime);
      }, pollingTime);
    } // endIf

    if (safemode == true) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds
        pcmaster = setTimeout(function repe() {
          callcomfoair(set232PCMaster);
          if (pcmastermode == false) {
            setTimeout(repe, 1000);
          }
        }, 500);
        testmaster = setInterval(testswitchpolling, 1000); //Ueberprüfen, ob PC-Master-mode aktiv ist.

        setTimeout(repeat, pollingTime);
      }, pollingTime);
    } //end polling
  }

  // all states changes inside the adapters namespace are subscribed
  adapter.subscribeStates('*');

} // endMain

function test() {

  if (pcmastermode == true) {
    adapter.log.debug("CC-Ease ausgeschaltet, Starte Adapterbetrieb");
    callval = setInterval(callvaluespcmaster, 2000); //DATAREQUEST;
    clearInterval(testmaster);
  } else {

    adapter.log.debug("Noch nicht im Adapter-only Modus");
    testj++;
    if (testj > 3) {
      adapter.log.warn("Fehler, kann nicht umschalten");
      testj = 0;
      clearInterval(testmaster);
    }
  }
} // END test()

function testswitchpolling() {

  if (pcmastermode == true) {

    adapter.log.debug("CC-Ease ausgeschaltet, Frage Werte ab");
    callvals = setInterval(callvaluessafe, 2000); //DATAREQUEST;
    clearInterval(testmaster);
  } else {

    adapter.log.debug("Noch nicht im PC-Master Modus");
    callcomfoair(set232PCMaster);
    testj++;
    if (testj > 3) {
      adapter.log.warn("Fehler, kann nicht umschalten");
      testj = 0;
      clearInterval(testmaster);
    }
  }
} // END testswitchpolling()

function testswitchcommand(id, state) {

  if (pcmastermode == true) {

    adapter.log.debug("CC-Ease ausgeschaltet, sende Befehl");
    setTimeout(function() {
      controlcomfoair(id, state);
    }, 500);

    clearInterval(testswi);
  } else {

    adapter.log.warn("Noch nicht im PC-Master Modus");
    callcomfoair(set232PCMaster);
    testj++;
    if (testj > 3) {
      adapter.log.warn("Fehler, kann nicht umschalten");
      testj = 0;
      clearInterval(testswi);
    }
  }
} // END testswitchcommand()


function callvaluespcmaster() {
  if (cceasemode == true) {
    return;
  }
  hexout = statcmdimaster[calli];
  adapter.log.debug("callcomfoair mit: " + hexout);
  callcomfoair(hexout);
  calli++;
  if (calli == statcmdimaster.length) {
    calli = 0;
    clearInterval(callval);
  }
} //end callvaluespcmaster

function callvaluessafe() {
  if (cceasemode == true) {
    return;
  }
  hexout = statcmdisafe[callj];
  adapter.log.debug("callcomfoair mit: " + hexout);
  callcomfoair(hexout);
  callj++;
  if (callj == statcmdisafe.length) {
    callj = 0;
    setTimeout(function() {
      adapter.log.debug("Setze RS232 auf PC Logmodus");
      callcomfoair(set232PCLogmode);
      setTimeout(function repete() {
        callcomfoair(set232PCLogmode);
        if (pcmastermode == true) {
          setTimeout(repete, 1000);
        }
      }, 500);
    }, 1000);

    clearInterval(callvals);
  }
} //end callvaluessafe

function controlcomfoair(id, state) {
  try {
    switch (id) {
      case "control.filterwos":
        if (verzoegerungensoll == null) {
          adapter.log.debug("Verzögerungswerte fehlen, Befehle wird nicht ausgeführt.");
          return;
        }
        for (var i = 0; i < 8; i++) {
          verzoegerungensoll[i + 5] = verzoegerungen[i + 7];
        }
        switch (state) {
          case 0:
            adapter.log.debug("Setzte Filtertimer auf 10 Wochen");
            verzoegerungensoll[9] = 10;
            verzoegerungensoll[13] = parseInt(checksumcmd(verzoegerungensoll), 16);
            break;

          case 1:
            adapter.log.debug("Setzte Filtertimer auf 16 Wochen");
            verzoegerungensoll[9] = 16;
            verzoegerungensoll[13] = parseInt(checksumcmd(verzoegerungensoll), 16);
            break;

          case 2:
            adapter.log.debug("Setzte Filtertimer auf 26 Wochen");
            verzoegerungensoll[9] = 26;
            verzoegerungensoll[13] = parseInt(checksumcmd(verzoegerungensoll), 16);
            break;
        }
        callcomfoair(verzoegerungensoll);
        break;

      case "control.selftest":
        if (state == true) {
          adapter.log.debug("Starte Selbsttest");
          callcomfoair(selbsttest);
        }
        break;

      case "control.stufe":
        adapter.log.debug("Setzte Stufe: " + state);
        callcomfoair(setfanstate[state]);
        break;

      case "control.comforttemp":
        adapter.log.debug("Setze Komforttemperatur auf: " + state + "°C");
        setcomfotemp[5] = ((state + 20) * 2);
        setcomfotemp[6] = parseInt(checksumcmd(setcomfotemp), 16);
        callcomfoair(setcomfotemp);
        break;

      case "control.reset.filterh":
        if (state == true) {
          adapter.log.debug("Setze Betriebsstunden Filter zurück");
          setreset[8] = 1;
          setreset[9] = parseInt(checksumcmd(setreset), 16);
          callcomfoair(setreset);
          setreset = [0x07, 0xF0, 0x00, 0xDB, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x07, 0x0F]
        }
        break;

      case "control.rs232mode":
        switch (state) {
          case 0:
            var statetext = "CC Ease only";
            adapter.log.debug("Umschalten auf CC Ease only");
            setrs232[5] = 0;
            cceasemode = true;
            safemode = false;
            pcmastermode = false;
            break;

          case 1:
            var statetext = "Adapter only";
            adapter.log.debug("Umschalten auf Adapter only");
            setrs232[5] = 3;
            cceasemode = false;
            safemode = false;
            if (pcmastermode == false && safemode == false) {
              testswi = setInterval(testswitchcommand, 1000); //Ueberprüfen, ob PC-Master-mode aktiv ist.
            }
            break;

          case 2:
            var statetext = "Parallel Mode";
            adapter.log.debug("Umschalten auf Parallelbetrieb");
            setrs232[5] = 4;
            cceasemode = false;
            safemode = false;
            pcmastermode = false;
            adapter.setState('status.rs232mode', 2, true);
            break;

          case 3:
            var statetext = "Auto Switch Mode";
            safemode = true;
            cceasemode = false;
            pcmastermode = false;
            adapter.setState('status.rs232mode', 3, true);
            break;

        }
        adapter.log.debug("Setze RS232 - Modus auf: " + statetext);

        setrs232[6] = parseInt(checksumcmd(setrs232), 16);
        callcomfoair(setrs232);
        setrs232 = [0x07, 0xF0, 0x00, 0x9B, 0x01, 0x00, 0x49, 0x07, 0x0F];
        break;


      default:
        if (id.slice(0, 15) == "control.setvent") {
          var setventl = setventlevel.indexOf(id.slice(16));
          if (state != setvent[setventl + 5]) {
            adapter.log.debug("Setze Ventilationsstufen");
            adapter.log.debug("Aendere: " + id.slice(16) + "Position: " + setventl);
            setvent[setventl + 5] = state;
            setvent[14] = parseInt(checksumcmd(setvent), 16);
            adapter.log.debug("Setvent neu: " + setvent);
            adapter.log.debug(id.slice(16) + " neu " + setvent[setventl + 5] + "%");

            callcomfoair(setvent);
            adapter.setState('control.setvent.ABLabw', setvent[5], true);
            adapter.setState('control.setvent.ABL1', setvent[6], true);
            adapter.setState('control.setvent.ABL2', setvent[7], true);
            adapter.setState('control.setvent.ZULabw', setvent[8], true);
            adapter.setState('control.setvent.ZUL2', setvent[10], true);
            adapter.setState('control.setvent.ZUL1', setvent[9], true);
            adapter.setState('control.setvent.ABL3', setvent[11], true);
            adapter.setState('control.setvent.ZUL3', setvent[12], true);
          }

        } else {
          adapter.log.debug("Befehl nicht erkannt");
        }
    }
    if (safemode == true) {
      setTimeout(function() {
        callvals = setInterval(callvaluessafe, 2000); //DATAREQUEST;
      }, 1000);
    }
  } catch (e) {
    adapter.log.debug("Fehler controlcomfoair: " + e);
  }

} //end controlcomfoair

function callcomfoair(hexout) {
  var client = new net.Socket();
  client.connect(port, deviceIpAdress, function() { //Connection Data ComfoAir
    adapter.log.debug('Connected');
    var msgbuf = new Buffer(hexout);
    var hexoutarr = [...msgbuf];
    adapter.log.debug("out " + msgbuf.toString('hex'));
    adapter.log.debug("outarr: " + hexoutarr);
    client.write(msgbuf);
  });




  client.on('error', function(ex) {
    adapter.log.warn("callcomfoair connection error: " + ex);
  });

  client.on('data', function(data) {
    var buff = new Buffer(data, 'utf8');
    adapter.log.debug('Received: ' + buff.toString('hex'));
    buffarr = [...buff];
    adapter.log.debug('Received arr: ' + buffarr);
    try {
      if (buffarr.length > 3) {
        adapter.log.debug("ACK: " + buffarr[0] + ", " + buffarr[1]);
        adapter.log.debug("Checksumme aus Datensatz: " + buffarr[buffarr.length - 3]);
        adapter.log.debug("Checksumme berechnet: " + parseInt(checksumcmd(buff.slice(2)), 16));
        if (buffarr[0] == 7 && buffarr[1] == 243 && buffarr[buffarr.length - 3] == parseInt(checksumcmd(buff.slice(2)), 16)) {
          adapter.log.debug("ACK erhalten und Checksumme ok");
          readComfoairData(buffarr);

        } else {
          adapter.log.debug("ACK zu Datenabfrage nicht erhalten oder Checksumme falsch");
        }
      } else {
        if (buff.toString('hex') == "07f3") {
          adapter.log.debug("ACK erhalten");
          switch (hexout[3]) {
            case 153:
              adapter.setState('status.statstufe', (hexout[5] - 1), true);
              break;
            case 211:
              adapter.setState('temperature.statcomfort', ((hexout[5] / 2) - 20), true);
              break;
            case 219:
              if (hexout[5] == 1) {
                adapter.log.debug("Störungen zurückgesetzt");
              }
              if (hexout[6] == 1) {
                adapter.log.debug("Einstellungen zurückgesetzt");
              }
              if (hexout[7] == 1) {
                adapter.log.debug("Selbsttest gestartet");
              }
              if (hexout[8] == 1) {
                adapter.log.debug("Betriebsstunden Filter zurückgesetzt");
                adapter.setState('status.filterChange', 0, true);
              }
              break;
            case 207:
              adapter.setState('status.ventlevel.ABLabw', hexout[5], true);
              adapter.setState('status.ventlevel.ABL1', hexout[6], true);
              adapter.setState('status.ventlevel.ABL2', hexout[7], true);
              adapter.setState('status.ventlevel.ZULabw', hexout[8], true);
              adapter.setState('status.ventlevel.ZUL2', hexout[10], true);
              adapter.setState('status.ventlevel.ZUL1', hexout[9], true);
              adapter.setState('status.ventlevel.ABL3', hexout[11], true);
              adapter.setState('status.ventlevel.ZUL3', hexout[12], true);
              adapter.log.debug("Ventilationsstufen gesetzt");
          }
        } else {
          adapter.log.debug("ACK zu Kommando nicht erhlaten");
        }
      }

    } catch (e) {
      adapter.log.warn("Client-Data - Fehler" + e);
    }
    client.destroy();
  });

  client.on('close', function() {
    adapter.log.debug('Connection closed');
  });
} //end callcomfoair

function listentocomfoair() {
  var decoder = new StringDecoder('utf8');
  var delimiterstream = new DelimiterStream({
    delimiter: '7,243,'
  });

  delimiterstream.on('data', function(chunk) {
    var chunkarr = decoder.write(chunk).split(',');
    if (chunkarr[3] > 65) {
      chunkarr.splice(0, 0, "7", "243");

      if (pcmastermode == false) {
        adapter.log.debug("an readcomfoair: " + chunkarr);
        readComfoairData(chunkarr);
      }
    }
  });

  var client = new net.Socket();

  var client = client.connect(port, deviceIpAdress, function() {
    // write out connection details
    adapter.log.debug('Connected to comfoair');
  });

  client.on('data', function(data) {
    var buff = new Buffer(data, 'utf8');
    //adapter.log.debug('Received: ' + buff.toString('hex'));
    buffarr = [...buff];
    delimiterstream.write(buffarr.toString('hex'));
  });

  client.on('close', function() {
    adapter.log.debug("Connection closed");
  });
} // end listentocomfoair()

function readComfoairData(buffarr) {
  try {
    adapter.log.debug("Verarbeite Daten");
    var cmd = parseInt(buffarr[5]);
    switch (cmd) {
      case 210:
        // listener & polling
        adapter.log.debug(cmd + " : lese Temperaturwerte");
        adapter.setState('temperature.statcomfort', ((buffarr[7] / 2) - 20), true);
        adapter.setState('temperature.AUL', ((buffarr[8] / 2) - 20), true);
        adapter.setState('temperature.ZUL', ((buffarr[9] / 2) - 20), true);
        adapter.setState('temperature.ABL', ((buffarr[10] / 2) - 20), true);
        adapter.setState('temperature.FOL', ((buffarr[11] / 2) - 20), true);
        adapter.setState('temperature.FOL', ((buffarr[11] / 2) - 20), true);
        break;

      case 206:
        // listener & polling
        adapter.log.debug(cmd + " : lese Ventilatorstatus");
        adapter.setState('status.ventlevel.ABLabw', buffarr[7], true);
        adapter.setState('status.ventlevel.ABL1', buffarr[8], true);
        adapter.setState('status.ventlevel.ABL2', buffarr[9], true);
        adapter.setState('status.ventlevel.ZULabw', buffarr[10], true);
        adapter.setState('status.ventlevel.ZUL1', buffarr[11], true);
        adapter.setState('status.ventlevel.ZUL2', buffarr[12], true);
        adapter.setState('status.ventABL', buffarr[13], true);
        adapter.setState('status.ventZUL', buffarr[14], true);
        adapter.setState('status.statstufe', (buffarr[15] - 1), true);
        adapter.setState('status.ventlevel.ABL3', buffarr[17], true);
        adapter.setState('status.ventlevel.ZUL3', buffarr[18], true);
        for (var i = 5; i < 11; i++) {
          setvent[i] = buffarr[i + 2];
        }
        setvent[11] = buffarr[17];
        setvent[12] = buffarr[18];
        break;

      case 222:
        //polling
        adapter.log.debug(cmd + " : lese Betriebsstunden");
        adapter.setState('status.filterh', parseInt((buffarr[22].toString(16) + buffarr[23].toString(16)), 16), true);
        break;

      case 14:
        //polling
        adapter.log.debug(cmd + " : lese Status Bypass");
        adapter.setState('status.bypass', buffarr[7], true);
        break;

      case 224:
        // listener
        adapter.log.debug(cmd + " : lese Status Bypass");
        break;

      case 202:
        //polling
        verzoegerungen = buffarr;
        adapter.setState("status.filterw", buffarr[11], true);
        break;

      case 218:
        //polling
        adapter.log.debug(cmd + ": lese Störungsmeldungen");
        adapter.setState("status.filterChange", buffarr[15], true);
        adapter.setState("status.errors.aktuellA", 'A' + errorcode(buffarr[7]), true);
        adapter.setState("status.errors.aktuellE", 'E' + errorcode(buffarr[8]), true);
        adapter.setState("status.errors.letzterA", 'A' + errorcode(buffarr[9]), true);
        adapter.setState("status.errors.letzterE", 'E' + errorcode(buffarr[10]), true);
        adapter.setState("status.errors.vorletzterA", 'A' + errorcode(buffarr[11]), true);
        adapter.setState("status.errors.vorletzterE", 'E' + errorcode(buffarr[12]), true);
        adapter.setState("status.errors.aktuellEA", 'EA' + errorcode(buffarr[16]), true);
        adapter.setState("status.errors.letzterEA", 'EA' + errorcode(buffarr[17]), true);
        adapter.setState("status.errors.vorletzterEA", 'EA' + errorcode(buffarr[18]), true);
        break;

      case 156:
        // listener & polling
        adapter.log.debug(cmd + ": lese rs232-Modus");
        adapter.log.debug("Modus - Code = " + parseInt(buffarr[7]));
        switch (parseInt(buffarr[7])) {
          case 1:
            var statetext = "PC only";
            rs232 = 1;
            if (safemode == true) {
              adapter.log.debug("Switch to Master/PConly");
            } else {
              adapter.log.debug("CC-Ease ausgeschaltet");
            }
            pcmastermode = true;
            adapter.setState('status.rs232mode', 1, true);
            break;

          case 2:
            var statetext = "CC-Ease only";
            rs232 = 0;
            adapter.log.debug("CC-Ease only Modus: keine Aktualisierung / Befehle durch Adapter");
            adapter.setState('status.rs232mode', 0, true);
            break;

          case 3:
            var statetext = "PC Master";
            rs232 = 1;
            if (safemode == true) {
              adapter.log.debug("Switch to Master");
            } else {
              adapter.log.debug("CC-Ease ausgeschaltet");
            }
            pcmastermode = true;
            adapter.setState('status.rs232mode', 1, true);
            break;

          case 4:
            pclogmode = true;
            rs232 = 2;
            if (safemode == true) {
              adapter.log.debug("Switch to Logmode");
              pcmastermode = false;
            } else {
              var statetext = "PC Logmode";
              adapter.log.debug("Parallelbetrieb aktiv");
            }
            adapter.setState('status.rs232mode', 2, true);
        }
        break;

      case 214:
        switch (buffarr[15]) {
          case 0:
            adapter.log.debug("Kein Enthalpietauscher");
            break;

          case 1:
            adapter.log.debug("Enthalpietauscher mit Sensor vorhanden");
            enthalpie = true;
            break;

          case 2:
            adapter.log.debug("Enthalpietauscher ohne Sensor");
            break;

        }
        break;

      case 152:
        // listener & polling
        adapter.log.debug(cmd + " : lese Enthalpietauscherwerte");
        adapter.setState('status.enthalpie.temp', ((buffarr[7] / 2) - 20), true);
        adapter.setState('status.enthalpie.hum', (buffarr[8]), true);
        adapter.setState('status.enthalpie.koeff', (buffarr[11]), true);
        break;

      default:
        adapter.log.debug("Fehler: ACK korrekt, aber Daten nicht erkannt");

    }
  } catch (e) {
    adapter.log.warn("readComfoairData - Fehler: " + e);
  }
} //end readComfoairData

function checksumcmd(csdata) {
  try {
    var checksum = 0;
    for (var i = 2; i < (csdata.length - 3); i++) {
      if (i > 5 && csdata[i] == 7 && csdata[i - 1] == 7) {
        adapter.log.debug("doppelte '07'");
      } else {
        checksum = checksum + csdata[i]
      }
    }
    checksum = ((checksum + 173).toString(16)).slice(-2);
    return checksum;

  } catch (e) {
    adapter.log.warn("ChecksumCmd - Fehler: " + e)
  }
} //end checksumcmd

function errorcode(error) {
  try {
    if (error > 0) {
      var errorcd = (1 + Math.log2(error)).toString();
    } else {
      var errorcd = ": kein Fehler";
    }
    return errorcd;
  } catch (e) {
    adapter.log.warn("errorcode - Fehler: " + e)
  }
} //end errorcode

function setcontrolobjects() {
  adapter.setObjectNotExists('control', {
    type: 'channel',
    common: {
      name: 'Steuerung'
    },
    native: {}
  });

  adapter.setObjectNotExists('control.rs232mode', {
    type: 'state',
    common: {
      name: 'Set RS232 Mode',
      desc: 'Setzen des Modus der RS232 - Schnittstelle',
      type: 'number',
      role: "info.control",
      read: true,
      write: true,
      states: {
        0: "CC Ease only",
        1: "PConly/PCMaster",
        2: "PCLogmode"
      },
      def: 1
    },
    native: {}
  });

  adapter.setObjectNotExists('control.comforttemp', {
    type: 'state',
    common: {
      name: 'Komforttemperatur',
      desc: 'Vorgabewert Komforttemperatur',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "°C"
    },
    native: {}
  });

  adapter.setObjectNotExists('control.stufe', {
    type: 'state',
    common: {
      name: 'Stufe',
      desc: 'Vorgabe Stufe',
      type: 'number',
      role: "info.value",
      read: true,
      write: true,
      states: {
        0: "Abwesend",
        1: "tief",
        2: "mittel",
        3: "hoch"
      },
      def: 1
    },
    native: {}
  });

  adapter.setObjectNotExists('control.resetfilterh', {
    type: 'state',
    common: {
      name: 'Reset Betriebsstunden Filter',
      desc: 'Zurücksetzen Betriebsstunden Filter',
      type: 'boolean',
      role: "value.control",
      read: true,
      write: true
    },
    native: {}
  });

  adapter.setObjectNotExists('control.setvent.ABLabw', {
    type: 'state',
    common: {
      name: 'Abluft abwesend',
      desc: 'Setzen Ventilationsstufe Abluft abwesend',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });

  adapter.setObjectNotExists('control.setvent.ZULabw', {
    type: 'state',
    common: {
      name: 'Zuluft abwesend',
      desc: 'Setzen Ventilationsstufe Zuluft abwesend',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('control.setvent.ABL1', {
    type: 'state',
    common: {
      name: 'Abluft Stufe 1',
      desc: 'Setzen Ventilationsstufe Abluft Stufe 1',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('control.setvent.ABL2', {
    type: 'state',
    common: {
      name: 'Abluft Stufe 2',
      desc: 'Setzen Ventilationsstufe Abluft Stufe 2',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('control.setvent.ABL3', {
    type: 'state',
    common: {
      name: 'Abluft Stufe 3',
      desc: 'Setzen Ventilationsstufe Abluft Stufe 3',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });

  adapter.setObjectNotExists('control.setvent.ZUL1', {
    type: 'state',
    common: {
      name: 'Zuluft Stufe 1',
      desc: 'Setzen Ventilationsstufe Zuluft Stufe 1',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });

  adapter.setObjectNotExists('control.setvent.ZUL2', {
    type: 'state',
    common: {
      name: 'Zuluft Stufe 2',
      desc: 'Setzen Ventilationsstufe Zuluft Stufe 2',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });

  adapter.setObjectNotExists('control.setvent.ZUL3', {
    type: 'state',
    common: {
      name: 'Zuluft Stufe 3',
      desc: 'Setzen Ventilationsstufe Zuluft Stufe 3',
      type: 'number',
      role: "value.control",
      read: true,
      write: true,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('control.selftest', {
    type: 'state',
    common: {
      name: 'Selbsttest',
      desc: 'Auslösen Selbsttest',
      type: 'boolean',
      role: "value.control",
      read: true,
      write: true
    },
    native: {}
  });
  adapter.setObjectNotExists('control.filterwos', {
    type: 'state',
    common: {
      name: 'FilterWochenSoll',
      desc: 'Vorgabe Filtertimer in Wochen',
      type: 'number',
      role: "info.value",
      read: true,
      write: true,
      states: {
        0: "10",
        1: "16",
        2: "26"
      },
      def: 1
    },
    native: {}
  });
} // end setcontrolobjects

function setpollingobjects() {
  adapter.setObjectNotExists('status.bypass', {
    type: "state",
    common: {
      name: "bypass",
      type: "number",
      role: "value.info",
      read: true,
      write: false,
      desc: "Klappenstatus Bypass",
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.filterChange', {
    type: "state",
    common: {
      name: "Filter wechseln",
      type: "boolean",
      role: "value.info",
      read: true,
      write: false,
      def: false,
      desc: "Filter Wechselanzeige"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.filterw', {
    type: "state",
    common: {
      name: "Filter Zähler Wochen",
      type: "number",
      role: "value.info",
      read: true,
      write: false,
      unit: "Wochen",
      desc: "Filter Wochenzähler"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.filterh', {
    type: "state",
    common: {
      name: "Betriebsstunden Filter",
      type: "number",
      role: "value.info",
      read: true,
      write: false,
      unit: "h",
      desc: "Betriebsstunden der Filter"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.aktuellA', {
    type: "state",
    common: {
      name: "aktueller Fehler A",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "aktueller Fehler A"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.letzterA', {
    type: "state",
    common: {
      name: "letzter Fehler A",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "letzer Fehler A"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.vorletzterA', {
    type: "state",
    common: {
      name: "vorletzter Fehler A",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "vorletzter Fehler A"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.aktuellE', {
    type: "state",
    common: {
      name: "aktueller Fehler E",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "aktueller Fehler E"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.letzterE', {
    type: "state",
    common: {
      name: "letzter Fehler E",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "letzer Fehler E"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.vorletzterE', {
    type: "state",
    common: {
      name: "vorletzter Fehler E",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "vorletzter Fehler E"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.aktuellEA', {
    type: "state",
    common: {
      name: "aktueller Fehler EA",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "aktueller Fehler EA"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.letzterEA', {
    type: "state",
    common: {
      name: "letzter Fehler EA",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "letzer Fehler EA"
    },
    native: {}
  });
  adapter.setObjectNotExists('status.errors.vorletzterEA', {
    type: "state",
    common: {
      name: "vorletzter Fehler EA",
      type: "string",
      role: "value.info",
      read: true,
      write: false,
      desc: "vorletzter Fehler EA"
    },
    native: {}
  });


}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
  module.exports = startAdapter;
} else {
  // or start the instance directly
  startAdapter();
} // endElse
