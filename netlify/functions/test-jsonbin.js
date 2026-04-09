// Temporary diagnostic function - test JSONBin connectivity
exports.handler = async (event) => {
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const key = process.env.JSONBIN_API_KEY;
  
  if (!key) return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: 'JSONBIN_API_KEY not set' }) };
  
  try {
    // Try to create a test bin
    const createRes = await fetch('https://api.jsonbin.io/v3/b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': key,
        'X-Bin-Name': 'markcmo-test',
        'X-Bin-Private': 'true',
      },
      body: JSON.stringify({ test: true, ts: new Date().toISOString() }),
    });
    const createData = await createRes.json();
    
    if (!createRes.ok || !createData.metadata?.id) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ 
        error: 'JSONBin create failed', 
        status: createRes.status,
        response: createData 
      })};
    }
    
    const binId = createData.metadata.id;
    
    // Try to read it back
    const readRes = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': key },
    });
    const readData = await readRes.json();
    
    return { statusCode: 200, headers: CORS, body: JSON.stringify({
      success: true,
      binId,
      keyPrefix: key.substring(0, 8) + '...',
      readOk: readRes.ok,
      recordTest: readData.record?.test,
    })};
    
  } catch (e) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ error: e.message }) };
  }
};
