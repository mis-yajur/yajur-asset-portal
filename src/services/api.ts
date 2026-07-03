const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbzhURx-xmb5c5GX24L2Hev-OV9RB3U7VsnuiRzPSSVkWMi48zf8GxmdB41DeHOU8b9s/exec';

// Automatically upgrade stored URL if it's the old or default one
const oldDefaults = [
  'https://script.google.com/macros/s/AKfycbytnxq-ShRWabByhO6fhxLtZeGTiMxduup42ADdIdLSsp0uPNszGut9HIaG5h-guNUD/exec',
];

let storedUrl = localStorage.getItem('LIFTING_API_URL') || import.meta.env.VITE_API_URL || DEFAULT_URL;

if (oldDefaults.includes(storedUrl)) {
  storedUrl = DEFAULT_URL;
  localStorage.setItem('LIFTING_API_URL', DEFAULT_URL);
}

let API_URL = storedUrl;

export function setApiUrl(url: string) {
  API_URL = url;
  localStorage.setItem('LIFTING_API_URL', url);
}

export function getApiUrl() {
  return API_URL;
}

export async function apiCall(action: string, params: any = {}) {
  console.log(`[API] Invoking action: ${action}`, params);
  
  if (!API_URL || API_URL.trim() === '') {
    console.error('API_URL is not defined.');
    return { success: false, error: 'API connection string missing' };
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ action, params }),
    });

    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('[API] Failed to parse JSON:', responseText);
      throw new Error('Invalid JSON response from server. Check Google Script logs.');
    }

    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unexpected error occurred' 
    };
  }
}
