/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define([
  'N/config',
  'N/https',
  'N/log',
  'N/record',
  'N/runtime',
  'N/search',
  'N/file',
  'N/format',
  'N/task',
  'N/encode'
], function (config, https, log, record, runtime, search, file, format, task, encode) {

  const CHUNK_SIZE_BYTES = 1048576; // 1 MB
  const CONFIG_TYPE = 'customrecord_zastro_lights_file_config';
  const FIELD_FILE_URL = 'custrecord_zastro_lights_update_file_url';
 // const FIELD_FILE_URL = 'custrecord_file_url';
  const FIELD_STOP_INDEX = 'custrecord_la_stoppedat'; // byte offset
  const FIELD_TOTAL_BYTES = 'custrecord_la_total';
  const FIELD_PARSED_HEADER = 'custrecord_la_parsed_header';
  const FOLDER_ID = 582734;

  const useHttpsModule = (url, rangeHeader) => {
      const resp = https.get({
          url: url,
          headers: {
              Accept: 'application/octet-stream',
              ...(rangeHeader ? { Range: rangeHeader } : {})
          }
      });
      const stream = resp.body;
      const decoded = encode.convert({
          string: stream,
          inputEncoding: encode.Encoding.BASE_64,
          outputEncoding: encode.Encoding.UTF_8
      });
      return decoded;
  };

  function getInputData() {
 //   return
      const configRecord = getConfig();
      const fileUrl = configRecord.getValue({ fieldId: FIELD_FILE_URL });
      let stopByte = parseInt(configRecord.getValue({ fieldId: FIELD_STOP_INDEX }) || '0');
      let totalBytes = parseInt(configRecord.getValue({ fieldId: FIELD_TOTAL_BYTES }) || '0');

      if (!totalBytes) {
          try {
              const rangeResponse = https.get({
                  url: fileUrl,
                  headers: { Range: 'bytes=0-0', Accept: 'application/octet-stream' }
              });
              const contentRange = rangeResponse.headers['Content-Range'] || rangeResponse.headers['content-range'];
              if (!contentRange) throw new Error('Missing Content-Range header');
              totalBytes = parseInt(contentRange.split('/')[1]);

              configRecord.setValue({ fieldId: FIELD_TOTAL_BYTES, value: totalBytes });
              configRecord.save();
          } catch (e) {
              log.error('Failed to determine totalBytes via Range GET', e);
              throw e;
          }
      }

      if (stopByte >= totalBytes) {
          log.audit('All data processed', `StoppedAt: ${stopByte}, Total: ${totalBytes}`);
          return [];
      }

      return [{ fileUrl: fileUrl, startByte: stopByte }];
  }

  function map(context) {
      const input = JSON.parse(context.value);
      const fileUrl = input.fileUrl;
      const startByte = parseInt(input.startByte);
      const endByte = startByte + CHUNK_SIZE_BYTES - 1;

      const rangeHeader = `bytes=${startByte}-${endByte}`;
      const chunkData = useHttpsModule(fileUrl, rangeHeader);

      const configRecord = getConfig();

      if (startByte === 0) {
          const firstNewline = chunkData.indexOf('\n');
          const header = chunkData.substring(0, firstNewline).trim();
          configRecord.setValue({ fieldId: FIELD_PARSED_HEADER, value: header });
          configRecord.save();
      }

      const header = configRecord.getValue({ fieldId: FIELD_PARSED_HEADER });
      const bodyWithoutHeader = chunkData.substring(chunkData.indexOf('\n') + 1);
      const fullChunk = header + '\n' + sanitizeCsvData(bodyWithoutHeader);

      context.write({
          key: startByte,
          value: JSON.stringify({ csv: fullChunk, stopByte: endByte + 1 })
      });
  }

  function reduce(context) {
      const data = JSON.parse(context.values[0]);
      const chunkCSV = data.csv;
      const stopByte = data.stopByte;

      const formattedDate = format.format({ value: new Date(), type: format.Type.DATE }).replace(/-/g, '');
      const randomStr = [...Array(10)].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32))).join('');
      const fileName = `CSV_${formattedDate}_${randomStr}.csv`;

      const csvFile = file.create({
          name: fileName,
          fileType: file.Type.CSV,
          contents: chunkCSV,
          folder: FOLDER_ID,
          isOnline: true
      });

      const fileId = csvFile.save();
      log.audit('Reduce - File created', { fileId: fileId, stopByte: stopByte });

      const configRecord = getConfig();
      configRecord.setValue({ fieldId: FIELD_STOP_INDEX, value: stopByte });
      configRecord.save();
  }

  function summarize(summary) {
      const configRecord = getConfig();
      const stoppedAt = parseInt(configRecord.getValue({ fieldId: FIELD_STOP_INDEX }) || '0');
      const total = parseInt(configRecord.getValue({ fieldId: FIELD_TOTAL_BYTES }) || '0');

      if (stoppedAt < total) {
          log.audit('Summarize - Rescheduling', `Progress: ${stoppedAt} / ${total}`);
          task.create({
              taskType: task.TaskType.MAP_REDUCE,
              scriptId: runtime.getCurrentScript().id,
              deploymentId: runtime.getCurrentScript().deploymentId
          }).submit();
      } else {
          log.audit('Summarize - All bytes processed', `Stopped at: ${stoppedAt}, Total: ${total}`);
      }
  }

  function getConfig() {
      const searchResult = search.create({
          type: CONFIG_TYPE,
          filters: [['isinactive', 'isnot', 'T']],
          columns: ['internalid']
      }).run().getRange({ start: 0, end: 1 });

      if (!searchResult.length) throw new Error('Config record not found');
      return record.load({ type: CONFIG_TYPE, id: searchResult[0].getValue({ name: 'internalid' }) });
  }

  function sanitizeCsvData(input) {
    return input.replace(/[^a-zA-Z0-9 \n\r,\/\.\-":&]/g, '');
}

  return {
      getInputData: getInputData,
      map: map,
      reduce: reduce,
      summarize: summarize
  };
});
