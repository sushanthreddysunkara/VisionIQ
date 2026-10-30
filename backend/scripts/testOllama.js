const start = Date.now();
console.log('Sending request to Ollama qwen3:8b...');

fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3:8b',
    prompt: 'You are a traffic parser. Convert query "Show speeding cars on Ring Road" into JSON with fields vehicleType, overspeedOnly, location, explanation.',
    format: 'json',
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 80
    }
  })
})
  .then(async (res) => {
    const elapsed = Date.now() - start;
    console.log(`HTTP Status: ${res.status} in ${elapsed}ms`);
    const data = await res.json();
    console.log('Response:\n', data.response);
  })
  .catch((err) => {
    console.error(`Fetch error in ${Date.now() - start}ms:`, err);
  });
