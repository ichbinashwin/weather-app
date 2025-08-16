// ----- helpers -----
const $ = (sel) => document.querySelector(sel);
const pad = (n) => n.toString().padStart(2, "0");

const WMO = {
  // WMO weather codes → label + theme + animation set
  0:  { label: "Clear sky", theme: "theme-sunny", anim: ["sunny"] },
  1:  { label: "Mainly clear", theme: "theme-sunny", anim: ["sunny","clouds"] },
  2:  { label: "Partly cloudy", theme: "theme-cloudy", anim: ["clouds","sunny"] },
  3:  { label: "Overcast", theme: "theme-overcast", anim: ["clouds"] },
  45: { label: "Fog", theme: "theme-overcast", anim: ["clouds"] },
  48: { label: "Rime fog", theme: "theme-overcast", anim: ["clouds"] },
  51: { label: "Light drizzle", theme: "theme-rain", anim: ["clouds","rain"] },
  53: { label: "Drizzle", theme: "theme-rain", anim: ["clouds","rain"] },
  55: { label: "Heavy drizzle", theme: "theme-rain", anim: ["clouds","rain"] },
  56: { label: "Freezing drizzle", theme: "theme-snow", anim: ["clouds","rain"] },
  57: { label: "Freezing drizzle", theme: "theme-snow", anim: ["clouds","rain"] },
  61: { label: "Light rain", theme: "theme-rain", anim: ["clouds","rain"] },
  63: { label: "Rain", theme: "theme-rain", anim: ["clouds","rain"] },
  65: { label: "Heavy rain", theme: "theme-rain", anim: ["clouds","rain"] },
  66: { label: "Freezing rain", theme: "theme-snow", anim: ["clouds","rain"] },
  67: { label: "Freezing rain", theme: "theme-snow", anim: ["clouds","rain"] },
  71: { label: "Light snow", theme: "theme-snow", anim: ["clouds"] },
  73: { label: "Snow", theme: "theme-snow", anim: ["clouds"] },
  75: { label: "Heavy snow", theme: "theme-snow", anim: ["clouds"] },
  77: { label: "Snow grains", theme: "theme-snow", anim: ["clouds"] },
  80: { label: "Rain showers", theme: "theme-rain", anim: ["clouds","rain"] },
  81: { label: "Rain showers", theme: "theme-rain", anim: ["clouds","rain"] },
  82: { label: "Violent rain", theme: "theme-rain", anim: ["clouds","rain"] },
  85: { label: "Snow showers", theme: "theme-snow", anim: ["clouds"] },
  86: { label: "Heavy snow", theme: "theme-snow", anim: ["clouds"] },
  95: { label: "Thunderstorm", theme: "theme-storm", anim: ["clouds","rain"] },
  96: { label: "Thunderstorm w/ hail", theme: "theme-storm", anim: ["clouds","rain"] },
  99: { label: "Thunderstorm w/ hail", theme: "theme-storm", anim: ["clouds","rain"] }
};

// build raindrops once
(function buildDrops(){
  const row = document.querySelector("#rain .row");
  const N = 40;
  for (let i=0;i<N;i++){
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#drop");
    const x = Math.random()*100;
    const delay = (Math.random()*1.2).toFixed(2);
    use.setAttribute("transform", `translate(${x}, 0)`);
    use.style.animationDelay = `${delay}s`;
    row.appendChild(use);
  }
})();

function setThemeByCode(code){
  const meta = WMO[code] || WMO[2];
  document.body.className = meta.theme;
  // Toggle SVGs
  ["sunny","clouds","rain"].forEach(id => {
    const el = document.getElementById(id);
    el.classList.toggle("hide", !meta.anim.includes(id));
  });
  return meta;
}

function showData({name, current, units, wind, humidity}){
  $("#locationName").textContent = name;
  $("#temp").textContent = `${Math.round(current.temperature_2m)}°${units.temperature_2m}`;
  $("#condition").textContent = current.label;
  $("#humidity").textContent = `${Math.round(humidity)}%`;
  $("#wind").textContent = `${Math.round(wind)} ${units.wind_speed_10m}`;
  const t = new Date();
  $("#updatedAt").textContent = `Updated ${pad(t.getHours())}:${pad(t.getMinutes())}`;
  $("#hint").textContent = `Tip: try entering “Berlin”, “94016”, or “Tokyo”.`;
}

async function ipLocation(){
  // ipapi.co works without an API key (fair-use rate limits)
  const r = await fetch("https://ipapi.co/json/");
  if(!r.ok) throw new Error("IP lookup failed");
  const j = await r.json();
  return {
    name: [j.city, j.region, j.country_name].filter(Boolean).join(", "),
    latitude: j.latitude,
    longitude: j.longitude
  };
}

async function geocode(query){
  // Open-Meteo Geocoding (free, CORS enabled)
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const r = await fetch(url);
  if(!r.ok) throw new Error("Geocoding failed");
  const j = await r.json();
  if(!j.results || !j.results.length) throw new Error("Location not found");
  const g = j.results[0];
  return { name: `${g.name}${g.admin1 ? ", " + g.admin1 : ""}${g.country ? ", " + g.country : ""}`, latitude: g.latitude, longitude: g.longitude };
}

async function fetchWeather({latitude, longitude}){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
  const r = await fetch(url);
  if(!r.ok) throw new Error("Weather fetch failed");
  const j = await r.json();
  return j;
}

async function loadByCoords(place){
  const data = await fetchWeather(place);
  const code = data.current.weather_code;
  const meta = setThemeByCode(code);
  showData({
    name: place.name || "Your location",
    current: { temperature_2m: data.current.temperature_2m, label: meta.label },
    units: data.current_units,
    wind: data.current.wind_speed_10m,
    humidity: data.current.relative_humidity_2m
  });
}

async function init(){
  // Start with IP (with graceful fallback to a default city)
  try{
    const ip = await ipLocation();
    await loadByCoords(ip);
  }catch(e){
    console.warn(e);
    const fallback = await geocode("London");
    await loadByCoords(fallback);
  }
}

$("#searchForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = $("#searchInput").value.trim();
  if(!q) return;
  $("#locationName").textContent = `Searching “${q}”…`;
  try{
    const g = await geocode(q);
    await loadByCoords(g);
  }catch(err){
    $("#locationName").textContent = "Location not found";
    $("#hint").textContent = "Try a different city or ZIP / postal code.";
  }
});

init();