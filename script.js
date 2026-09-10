// script.js

const state = {
  searchMode: 'RECOMMEND', // 'RECOMMEND' | 'CUSTOM'
  users: [
    { id: 1, label: '나', name: '', address: '', coords: null, mode: 'TRANSIT', isSelected: false },
    { id: 2, label: '친구 1', name: '', address: '', coords: null, mode: 'TRANSIT', isSelected: false },
    { id: 3, label: '친구 2', name: '', address: '', coords: null, mode: 'WALK', isSelected: false }
  ],
  customTarget: { name: '', address: '', coords: null },
  nextUserId: 4,
  map: null,
  markers: [],
  polylines: [],
  currentResults: [],
  selectedPlaceIndex: 0,
  expandedSubPlaceIndex: -1,
  subPlacesData: {},
  displayCount: 5,
  isKakaoAvailable: false
};

const FALLBACK_LOCATIONS = {
  '의정부역 (지하철역)': { lat: 37.7384, lng: 127.0459, address: '경기 의정부시 평화로 525' },
  '신세계백화점 의정부점': { lat: 37.7382, lng: 127.0465, address: '경기 의정부시 평화로 525' },
  '행복로 문화의거리': { lat: 37.7398, lng: 127.0482, address: '경기 의정부시 시민로121번길 일대' },
  '의정부 미술도서관': { lat: 37.7472, lng: 127.0785, address: '경기 의정부시 민락로 248' },
  '중랑천 시민공원': { lat: 37.7345, lng: 127.0490, address: '경기 의정부시 의정부동 중랑천변' },
  '민락2지구 로데오거리': { lat: 37.7512, lng: 127.0895, address: '경기 의정부시 오목로225번길' },
  '의정부 예술의전당': { lat: 37.7302, lng: 127.0398, address: '경기 의정부시 의정부로 1' },
  '스타벅스 의정부D.T': { lat: 37.7420, lng: 127.0435, address: '경기 의정부시 호국로 1310' },
  'CGV 의정부': { lat: 37.7383, lng: 127.0468, address: '경기 의정부시 평화로 525 10층' },
  '회룡역': { lat: 37.7248, lng: 127.0468, address: '경기 의정부시 평화로 363' }
};

document.addEventListener('DOMContentLoaded', () => {
  renderUserInputs();
  setupEventListeners();
  initKakaoSDK();

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrapper')) closeAllDropdowns();
  });
});

function initKakaoSDK() {
  const noticeEl = document.getElementById('map-fallback-notice');
  if (typeof kakao !== 'undefined' && kakao.maps) {
    kakao.maps.load(() => {
      if (kakao.maps.services) {
        state.isKakaoAvailable = true;
        noticeEl.classList.add('hidden');
        initMap();
      } else noticeEl.classList.remove('hidden');
    });
  } else noticeEl.classList.remove('hidden');
}

function initMap() {
  const mapContainer = document.getElementById('map');
  const defaultPos = new kakao.maps.LatLng(37.7384, 127.0459);
  if (state.isKakaoAvailable && mapContainer) {
    state.map = new kakao.maps.Map(mapContainer, { center: defaultPos, level: 6 });
  }
}

function setupEventListeners() {
  document.getElementById('add-user-btn').addEventListener('click', addUser);
  document.getElementById('search-btn').addEventListener('click', handleSearch);
  document.getElementById('demo-btn').addEventListener('click', loadDemoData);
  document.getElementById('load-more-btn').addEventListener('click', loadMoreResults);

  document.getElementById('tab-recommend').addEventListener('click', () => setMode('RECOMMEND'));
  document.getElementById('tab-custom').addEventListener('click', () => setMode('CUSTOM'));

  document.querySelectorAll('input[name="landmark-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
      e.target.closest('.category-btn').classList.add('active');
    });
  });

  const customInput = document.getElementById('custom-place-input');
  let debounceTimer;
  customInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    state.customTarget = { name: query, address: '', coords: null };
    document.getElementById('selected-custom-badge').classList.add('hidden');

    clearTimeout(debounceTimer);
    if (query.length >= 2) {
      debounceTimer = setTimeout(() => fetchCustomSuggestions(query), 200);
    } else closeDropdown('custom');
  });
}

function setMode(mode) {
  state.searchMode = mode;
  const tabRec = document.getElementById('tab-recommend');
  const tabCust = document.getElementById('tab-custom');
  const catSection = document.getElementById('category-section');
  const custSection = document.getElementById('custom-place-section');

  if (mode === 'RECOMMEND') {
    tabRec.classList.add('active');
    tabCust.classList.remove('active');
    catSection.classList.remove('hidden');
    custSection.classList.add('hidden');
  } else {
    tabCust.classList.add('active');
    tabRec.classList.remove('active');
    catSection.classList.add('hidden');
    custSection.classList.remove('hidden');
  }
}

function renderUserInputs() {
  const container = document.getElementById('user-inputs');
  container.innerHTML = '';

  state.users.forEach((user) => {
    const row = document.createElement('div');
    row.className = 'input-row';
    row.innerHTML = `
      <div class="input-wrapper">
        <input type="text" placeholder="${user.label} 출발지 (예: 의정부역)" value="${user.name}" data-id="${user.id}" class="user-input" autocomplete="off">
        ${user.isSelected && user.address ? `<span class="selected-addr-badge">✓ ${user.address}</span>` : ''}
        <div class="search-dropdown hidden" id="dropdown-${user.id}"></div>
      </div>
      <select class="mode-select" data-id="${user.id}">
        <option value="TRANSIT" ${user.mode === 'TRANSIT' ? 'selected' : ''}>🚌 버스/지하철</option>
        <option value="WALK" ${user.mode === 'WALK' ? 'selected' : ''}>🚶 도보</option>
      </select>
      ${state.users.length > 2 ? `<button class="btn-remove" data-id="${user.id}">&times;</button>` : ''}
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('.mode-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const user = state.users.find(u => u.id === parseInt(e.target.dataset.id));
      if (user) user.mode = e.target.value;
    });
  });

  container.querySelectorAll('.user-input').forEach(input => {
    let debounceTimer;
    input.addEventListener('input', (e) => {
      const id = parseInt(e.target.dataset.id);
      const user = state.users.find(u => u.id === id);
      const query = e.target.value.trim();
      if (user) { user.name = query; user.isSelected = false; user.coords = null; }

      clearTimeout(debounceTimer);
      if (query.length >= 2) {
        debounceTimer = setTimeout(() => fetchSearchSuggestions(query, id), 200);
      } else closeDropdown(id);
    });
  });

  container.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      state.users = state.users.filter(u => u.id !== parseInt(e.target.dataset.id));
      renderUserInputs();
    });
  });
}

function fetchSearchSuggestions(keyword, userId) {
  const dropdown = document.getElementById(`dropdown-${userId}`);
  if (!dropdown) return;

  if (state.isKakaoAvailable) {
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(keyword, (data, status) => {
      if (status === kakao.maps.services.Status.OK) renderDropdownList(dropdown, data, userId);
      else closeDropdown(userId);
    });
  } else {
    const matches = Object.keys(FALLBACK_LOCATIONS).filter(k => k.includes(keyword))
      .map(k => ({ place_name: k, address_name: FALLBACK_LOCATIONS[k].address, x: FALLBACK_LOCATIONS[k].lng, y: FALLBACK_LOCATIONS[k].lat }));
    renderDropdownList(dropdown, matches, userId);
  }
}

function fetchCustomSuggestions(keyword) {
  const dropdown = document.getElementById('dropdown-custom');
  if (!dropdown) return;

  if (state.isKakaoAvailable) {
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(keyword, (data, status) => {
      if (status === kakao.maps.services.Status.OK) renderCustomDropdownList(dropdown, data);
      else closeDropdown('custom');
    });
  } else {
    const matches = Object.keys(FALLBACK_LOCATIONS).filter(k => k.includes(keyword))
      .map(k => ({ place_name: k, address_name: FALLBACK_LOCATIONS[k].address, x: FALLBACK_LOCATIONS[k].lng, y: FALLBACK_LOCATIONS[k].lat }));
    renderCustomDropdownList(dropdown, matches);
  }
}

function renderDropdownList(dropdown, items, userId) {
  dropdown.innerHTML = ''; dropdown.classList.remove('hidden');
  items.slice(0, 5).forEach(item => {
    const div = document.createElement('div');
    div.className = 'dropdown-item';
    const addr = item.road_address_name || item.address_name || '';
    div.innerHTML = `<div class="place-title">${item.place_name}</div><div class="place-addr">${addr}</div>`;
    div.addEventListener('click', () => {
      const user = state.users.find(u => u.id === userId);
      if (user) { user.name = item.place_name; user.address = addr; user.coords = { lat: parseFloat(item.y), lng: parseFloat(item.x) }; user.isSelected = true; }
      closeAllDropdowns();
      renderUserInputs();
    });
    dropdown.appendChild(div);
  });
}

function renderCustomDropdownList(dropdown, items) {
  dropdown.innerHTML = ''; dropdown.classList.remove('hidden');
  items.slice(0, 5).forEach(item => {
    const div = document.createElement('div');
    div.className = 'dropdown-item';
    const addr = item.road_address_name || item.address_name || '';
    div.innerHTML = `<div class="place-title">${item.place_name}</div><div class="place-addr">${addr}</div>`;
    div.addEventListener('click', () => {
      state.customTarget = { name: item.place_name, address: addr, coords: { lat: parseFloat(item.y), lng: parseFloat(item.x) } };
      document.getElementById('custom-place-input').value = item.place_name;
      const badge = document.getElementById('selected-custom-badge');
      badge.textContent = `✓ 선택됨: ${addr}`;
      badge.classList.remove('hidden');
      closeAllDropdowns();
    });
    dropdown.appendChild(div);
  });
}

function closeDropdown(id) {
  const el = document.getElementById(`dropdown-${id}`);
  if (el) el.classList.add('hidden');
}
function closeAllDropdowns() {
  document.querySelectorAll('.search-dropdown').forEach(d => d.classList.add('hidden'));
}

function addUser() {
  if (state.users.length >= 5) return showStatus('최대 5명까지 추가 가능합니다.');
  state.users.push({ id: state.nextUserId++, label: `친구 ${state.users.length}`, name: '', address: '', coords: null, mode: 'TRANSIT', isSelected: false });
  renderUserInputs();
}

function loadDemoData() {
  hideStatus();
  state.users = [
    { id: 1, label: '나', name: '의정부역', address: FALLBACK_LOCATIONS['의정부역 (지하철역)'].address, coords: FALLBACK_LOCATIONS['의정부역 (지하철역)'], mode: 'TRANSIT', isSelected: true },
    { id: 2, label: '친구 1', name: '회룡역', address: FALLBACK_LOCATIONS['회룡역'].address, coords: FALLBACK_LOCATIONS['회룡역'], mode: 'WALK', isSelected: true },
    { id: 3, label: '친구 2', name: '민락동', address: FALLBACK_LOCATIONS['민락2지구 로데오거리'].address, coords: FALLBACK_LOCATIONS['민락2지구 로데오거리'], mode: 'TRANSIT', isSelected: true }
  ];
  renderUserInputs();
  handleSearch();
}

function calculateTravelTime(distKm, mode) {
  if (mode === 'WALK') return Math.max(3, Math.round((distKm / 4.2) * 60));
  return Math.max(5, Math.round(5 + (distKm / 20) * 60));
}

function calculateFairness(times) {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const maxDiff = Math.max(...times) - Math.min(...times);
  
  const diffPenalty = maxDiff * 1.2;
  const avgPenalty = avg * 0.1;
  let score = 100 - diffPenalty - avgPenalty;
  score = Math.max(15, Math.min(100, Math.round(score)));
  
  return { avgTime: Math.round(avg), maxDiff, score };
}

async function handleSearch() {
  hideStatus();
  closeAllDropdowns();
  state.expandedSubPlaceIndex = -1;
  state.subPlacesData = {};
  state.displayCount = 5;

  const validUsers = state.users.filter(u => u.name.trim().length > 0);
  if (validUsers.length < 2) return showStatus('최소 2명 이상의 출발지를 입력해 주세요.');

  try {
    for (let user of validUsers) {
      if (!user.coords) user.coords = await geocodePlace(user.name);
    }

    let candidatePlaces = [];

    if (state.searchMode === 'RECOMMEND') {
      const centerCoords = calculateCenter(validUsers.map(u => u.coords));
      const lType = document.querySelector('input[name="landmark-type"]:checked').value;
      candidatePlaces = await fetchDiversePlaces(centerCoords, lType);
      document.getElementById('result-title').textContent = "🎯 공평한 추천 약속 장소";
    } else {
      if (!state.customTarget.name) return showStatus('만날 장소를 직접 입력하거나 검색해 주세요.');
      if (!state.customTarget.coords) state.customTarget.coords = await geocodePlace(state.customTarget.name);
      candidatePlaces = [state.customTarget];
      document.getElementById('result-title').textContent = "📍 지정한 약속 장소 분석";
    }

    const results = evaluateCandidates(validUsers, candidatePlaces);
    
    if (state.searchMode === 'RECOMMEND') {
      results.sort((a, b) => b.metrics.score - a.metrics.score);
    }

    state.currentResults = results;
    state.selectedPlaceIndex = 0;

    renderSidebarResults(results, validUsers);
    renderMapVisuals(validUsers, results, 0);

  } catch (error) {
    showStatus(error.message || '장소를 찾는 중 오류가 발생했습니다.');
  }
}

function geocodePlace(placeName) {
  return new Promise((resolve) => {
    if (state.isKakaoAvailable) {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(placeName, (data, status) => {
        if (status === kakao.maps.services.Status.OK && data.length > 0) {
          resolve({ lat: parseFloat(data[0].y), lng: parseFloat(data[0].x) });
          return;
        }
        resolve(getFallbackCoords(placeName));
      });
    } else resolve(getFallbackCoords(placeName));
  });
}

function getFallbackCoords(name) {
  if (FALLBACK_LOCATIONS[name]) return FALLBACK_LOCATIONS[name];
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  return { lat: 37.7384 + (hash % 20 - 10) * 0.003, lng: 127.0459 + (hash % 30 - 15) * 0.003 };
}

function calculateCenter(coordsList) {
  const sum = coordsList.reduce((acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / coordsList.length, lng: sum.lng / coordsList.length };
}

async function fetchDiversePlaces(center, type) {
  if (!state.isKakaoAvailable) return getFallbackDiversePlaces(type);

  const ps = new kakao.maps.services.Places();
  const options = { location: new kakao.maps.LatLng(center.lat, center.lng), radius: 3500 };
  
  let searchKeywords = [];
  if (type === 'STATION') searchKeywords = ['지하철역', '전철역', '버스터미널'];
  else if (type === 'MALL') searchKeywords = ['백화점', '쇼핑몰', '아울렛', '대형마트'];
  else if (type === 'CAFE') searchKeywords = ['대형카페', '카페거리', '디저트카페', '스타벅스'];
  else if (type === 'PARK') searchKeywords = ['광장', '시민공원', '문화의거리', '로데오거리'];
  else if (type === 'CULTURE') searchKeywords = ['영화관', '미술관', '도서관', '복합문화공간'];
  else searchKeywords = ['역', '백화점', '대형카페', '문화의거리', '도서관', '공원'];

  const placeMap = new Map();

  for (let kw of searchKeywords) {
    await new Promise((res) => {
      ps.keywordSearch(kw, (data, status) => {
        if (status === kakao.maps.services.Status.OK && data.length > 0) {
          data.slice(0, 4).forEach(i => {
            if (!placeMap.has(i.place_name)) {
              placeMap.set(i.place_name, {
                name: i.place_name,
                originalName: i.place_name,
                address: i.address_name || i.road_address_name,
                coords: { lat: parseFloat(i.y), lng: parseFloat(i.x) }
              });
            }
          });
        }
        res();
      }, options);
    });
  }

  const result = Array.from(placeMap.values());
  return result.length > 0 ? result : getFallbackDiversePlaces(type);
}

function getFallbackDiversePlaces(type) {
  const allList = Object.keys(FALLBACK_LOCATIONS).map(key => ({
    name: key,
    originalName: key,
    address: FALLBACK_LOCATIONS[key].address,
    coords: { lat: FALLBACK_LOCATIONS[key].lat, lng: FALLBACK_LOCATIONS[key].lng }
  }));

  if (type === 'STATION') return allList.filter(i => i.name.includes('역'));
  if (type === 'MALL') return allList.filter(i => i.name.includes('백화점') || i.name.includes('아울렛'));
  if (type === 'CAFE') return allList.filter(i => i.name.includes('카페') || i.name.includes('스타벅스'));
  if (type === 'PARK') return allList.filter(i => i.name.includes('거리') || i.name.includes('공원'));
  if (type === 'CULTURE') return allList.filter(i => i.name.includes('도서관') || i.name.includes('CGV') || i.name.includes('예술'));
  return allList;
}

// 카카오 공식 카테고리 API(CE7: 카페, FD6: 음식점)로 주변 600m 이내 매장 가져오기
function fetchSubPlacesAroundLandmark(coords) {
  return new Promise((resolve) => {
    if (!state.isKakaoAvailable) {
      resolve([
        { name: '투썸플레이스', category: '☕ 카페', address: '주변 100m 이내', coords },
        { name: '스타벅스', category: '☕ 카페', address: '주변 200m 이내', coords },
        { name: '주변 파스타 전문점', category: '🍕 맛집', address: '주변 150m 이내', coords },
        { name: '수제버거 맛집', category: '🍕 맛집', address: '주변 250m 이내', coords }
      ]);
      return;
    }

    const ps = new kakao.maps.services.Places();
    const options = { 
      location: new kakao.maps.LatLng(coords.lat, coords.lng), 
      radius: 600,
      sort: kakao.maps.services.SortBy.DISTANCE 
    };
    const subList = [];

    // 1. 카카오 공식 카페 카테고리 검색 (CE7)
    ps.categorySearch('CE7', (cafeData, cafeStatus) => {
      if (cafeStatus === kakao.maps.services.Status.OK && cafeData.length > 0) {
        cafeData.slice(0, 4).forEach(item => {
          subList.push({
            name: item.place_name,
            category: '☕ 카페',
            address: item.road_address_name || item.address_name || '주소 정보 없음',
            coords: { lat: parseFloat(item.y), lng: parseFloat(item.x) }
          });
        });
      }

      // 2. 카카오 공식 음식점 카테고리 검색 (FD6)
      ps.categorySearch('FD6', (foodData, foodStatus) => {
        if (foodStatus === kakao.maps.services.Status.OK && foodData.length > 0) {
          foodData.slice(0, 4).forEach(item => {
            subList.push({
              name: item.place_name,
              category: '🍕 맛집',
              address: item.road_address_name || item.address_name || '주소 정보 없음',
              coords: { lat: parseFloat(item.y), lng: parseFloat(item.x) }
            });
          });
        }
        resolve(subList);
      }, options);
    }, options);
  });
}

function evaluateCandidates(users, candidates) {
  return candidates.map(place => {
    const originalName = place.originalName || place.name;
    const userTimes = users.map(user => {
      const distKm = getDistanceKm(user.coords.lat, user.coords.lng, place.coords.lat, place.coords.lng);
      return { label: user.label, name: user.name, mode: user.mode, distKm, time: calculateTravelTime(distKm, user.mode) };
    });
    return { ...place, originalName, userTimes, metrics: calculateFairness(userTimes.map(u => u.time)) };
  });
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderSidebarResults(results, users) {
  const section = document.getElementById('result-section');
  const cardsContainer = document.getElementById('ranking-cards');
  const loadMoreBtn = document.getElementById('load-more-btn');
  section.classList.remove('hidden');
  cardsContainer.innerHTML = '';

  const displayList = results.slice(0, state.displayCount);
  
  if (results.length > state.displayCount) {
    loadMoreBtn.classList.remove('hidden');
  } else {
    loadMoreBtn.classList.add('hidden');
  }

  displayList.forEach((item, index) => {
    const isSelected = index === state.selectedPlaceIndex;
    const isExpanded = index === state.expandedSubPlaceIndex;
    const card = document.createElement('div');
    card.className = `card rank-${index + 1} ${isSelected ? 'selected' : ''}`;

    const userSummaryRows = item.userTimes.map(ut => `
      <div class="user-time-item">
        <span>${ut.label} (${ut.mode === 'WALK' ? '🚶도보' : '🚌버스'})</span>
        <span><strong>${ut.time}분</strong> (${ut.distKm.toFixed(1)}km)</span>
      </div>
    `).join('');

    let subPlacesHtml = '';
    if (isExpanded) {
      const list = state.subPlacesData[index] || [];
      const itemsHtml = list.map((sp, spIdx) => {
        return `
          <div class="sub-place-item" onclick="selectSubPlace(${index}, ${spIdx})">
            <div class="sub-place-info">
              <span class="sub-place-name">📍 ${sp.name}</span>
              <span class="sub-place-addr">${sp.address}</span>
            </div>
            <span class="sub-place-cat">${sp.category}</span>
          </div>
        `;
      }).join('');

      subPlacesHtml = `
        <div class="sub-places-box" onclick="event.stopPropagation()">
          <div class="sub-places-title">🏢 [${item.originalName || item.name}] 주변 추천 카페 및 맛집</div>
          <div class="sub-places-grid">
            ${itemsHtml.length > 0 ? itemsHtml : '<div style="font-size:0.75rem; color:#666; padding:8px;">주변 카페/맛집 정보를 가져오는 중입니다...</div>'}
          </div>
        </div>
      `;
    }

    let routeDetailsHtml = '';
    if (isSelected) {
      const timelineBlocks = item.userTimes.map(ut => {
        const user = users.find(u => u.label === ut.label) || {};
        const uLat = user.coords ? user.coords.lat : '';
        const uLng = user.coords ? user.coords.lng : '';
        const pLat = item.coords.lat;
        const pLng = item.coords.lng;

        const kakaoNaviUrl = `https://map.kakao.com/link/to/${encodeURIComponent(item.name)},${pLat},${pLng}/from/${encodeURIComponent(ut.name)},${uLat},${uLng}`;

        let stepsHtml = '';
        let naviBtnHtml = '';

        if (ut.mode === 'WALK') {
          stepsHtml = `
            <li class="route-step">🚩 <strong>[출발]</strong> ${ut.name}</li>
            <li class="route-step">🚶 <strong>도보 이동:</strong> 약 ${ut.distKm.toFixed(1)}km (소요시간 약 ${ut.time}분)</li>
            <li class="route-step">🏁 <strong>[도착]</strong> ${item.name}</li>
          `;
          naviBtnHtml = `
            <a href="${kakaoNaviUrl}" target="_blank" rel="noopener noreferrer" class="btn-navi btn-navi-walk">
              <span class="btn-navi-content">
                <span class="btn-navi-title">🚶 ${ut.label}의 도보 경로 확인</span>
                <span class="btn-navi-sub">네비게이션 및 보행자 길안내</span>
              </span>
              <span class="btn-navi-arrow">↗</span>
            </a>
          `;
        } else {
          stepsHtml = `
            <li class="route-step">🚩 <strong>[출발]</strong> ${ut.name}</li>
            <li class="route-step">🚌 <strong>대중교통 이동:</strong> 약 ${ut.distKm.toFixed(1)}km (소요시간 약 ${ut.time}분)</li>
            <li class="route-step">🏁 <strong>[도착]</strong> ${item.name}</li>
          `;
          naviBtnHtml = `
            <a href="${kakaoNaviUrl}" target="_blank" rel="noopener noreferrer" class="btn-navi btn-navi-transit">
              <span class="btn-navi-content">
                <span class="btn-navi-title">🚌 ${ut.label}의 버스·지하철 경로 확인</span>
                <span class="btn-navi-sub">실시간 버스 번호 및 탑승/하차 정류장 안내</span>
              </span>
              <span class="btn-navi-arrow">↗</span>
            </a>
          `;
        }

        return `
          <div class="route-user-block">
            <div class="route-user-header">
              <span>${ut.label} (${ut.name})</span>
              <span>약 ${ut.time}분 소요</span>
            </div>
            <ul class="route-steps">${stepsHtml}</ul>
            ${naviBtnHtml}
          </div>
        `;
      }).join('');

      routeDetailsHtml = `
        <div class="route-detail-panel">
          <div class="route-detail-title">📍 상세 이동 경로 안내</div>
          <div class="route-timeline">${timelineBlocks}</div>
        </div>
      `;
    }

    card.innerHTML = `
      ${state.searchMode === 'RECOMMEND' ? `<span class="badge-rank">${index + 1}위 추천 장소</span>` : '<span class="badge-rank">지정 거점</span>'}
      <div class="card-title">${item.name}</div>
      <div class="card-address">${item.address || '주소 정보 없음'}</div>
      <div class="score-tag">공평성 점수: ${item.metrics.score}점</div>
      <div class="user-time-summary">${userSummaryRows}</div>
      
      <button type="button" class="btn-more-details" onclick="event.stopPropagation(); toggleSubPlaces(${index});">
        ${isExpanded ? '▲ 주변 카페/식당 접기' : '🔍 주변 세부 매장 (카페·맛집) 선택'}
      </button>

      ${subPlacesHtml}
      ${routeDetailsHtml}
    `;

    card.addEventListener('click', () => {
      state.selectedPlaceIndex = index;
      renderSidebarResults(results, users);
      renderMapVisuals(users, results, index);
    });

    cardsContainer.appendChild(card);
  });
}

function loadMoreResults() {
  state.displayCount += 5;
  const validUsers = state.users.filter(u => u.name.trim().length > 0);
  renderSidebarResults(state.currentResults, validUsers);
}

async function toggleSubPlaces(index) {
  if (state.expandedSubPlaceIndex === index) {
    state.expandedSubPlaceIndex = -1;
  } else {
    state.expandedSubPlaceIndex = index;
    state.selectedPlaceIndex = index;
    
    if (!state.subPlacesData[index]) {
      const place = state.currentResults[index];
      const subList = await fetchSubPlacesAroundLandmark(place.coords);
      state.subPlacesData[index] = subList;
    }
  }
  const validUsers = state.users.filter(u => u.name.trim().length > 0);
  renderSidebarResults(state.currentResults, validUsers);
}

// 세부 매장 선택 시 장소 정보 업데이트 및 경로/지도 좌표 반영
function selectSubPlace(cardIndex, subPlaceIndex) {
  const currentPlace = state.currentResults[cardIndex];
  const subPlace = state.subPlacesData[cardIndex]?.[subPlaceIndex];
  if (!subPlace) return;

  if (!currentPlace.originalName) {
    currentPlace.originalName = currentPlace.name;
  }

  // 매장명, 주소, 실제 좌표 업데이트
  currentPlace.name = `${subPlace.name} (${currentPlace.originalName} 인근)`;
  currentPlace.address = subPlace.address;
  currentPlace.coords = subPlace.coords;

  // 세부 매장 좌표 기준으로 이동시간/거리/공평성 점수 재계산
  const validUsers = state.users.filter(u => u.name.trim().length > 0);
  currentPlace.userTimes = validUsers.map(user => {
    const distKm = getDistanceKm(user.coords.lat, user.coords.lng, currentPlace.coords.lat, currentPlace.coords.lng);
    return { label: user.label, name: user.name, mode: user.mode, distKm, time: calculateTravelTime(distKm, user.mode) };
  });
  currentPlace.metrics = calculateFairness(currentPlace.userTimes.map(u => u.time));

  renderSidebarResults(state.currentResults, validUsers);
  renderMapVisuals(validUsers, state.currentResults, cardIndex);
}

function renderMapVisuals(users, results, targetIndex) {
  if (!state.isKakaoAvailable || !state.map) return;
  state.map.relayout();

  state.markers.forEach(m => m.setMap(null));
  state.polylines.forEach(p => p.setMap(null));
  state.markers = []; state.polylines = [];

  const bounds = new kakao.maps.LatLngBounds();
  const targetPlace = results[targetIndex];
  if (!targetPlace) return;

  const targetPos = new kakao.maps.LatLng(targetPlace.coords.lat, targetPlace.coords.lng);

  users.forEach((user) => {
    const userPos = new kakao.maps.LatLng(user.coords.lat, user.coords.lng);
    const isWalk = user.mode === 'WALK';

    const overlay = new kakao.maps.CustomOverlay({
      position: userPos,
      content: `<div style="padding:4px 8px; background:${isWalk ? '#2563eb' : '#7c3aed'}; color:#fff; font-weight:bold; font-size:11px; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.2);">${isWalk ? '🚶' : '🚌'} ${user.label}</div>`,
      yAnchor: 1
    });
    overlay.setMap(state.map);
    state.markers.push(overlay);
    bounds.extend(userPos);

    const polyline = new kakao.maps.Polyline({
      path: [userPos, targetPos],
      strokeWeight: 4, strokeColor: isWalk ? '#2563eb' : '#7c3aed', strokeOpacity: 0.8
    });
    polyline.setMap(state.map);
    state.polylines.push(polyline);
  });

  const destOverlay = new kakao.maps.CustomOverlay({
    position: targetPos,
    content: `<div style="padding:6px 12px; background:#f59e0b; color:#fff; font-weight:bold; font-size:12px; border-radius:14px; border:2px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.3);">📍 ${targetPlace.name}</div>`,
    yAnchor: 1
  });
  destOverlay.setMap(state.map);
  state.markers.push(destOverlay);
  bounds.extend(targetPos);

  state.map.setBounds(bounds);
}

function showStatus(msg) {
  const el = document.getElementById('status-message');
  el.textContent = msg; el.classList.remove('hidden');
}

function hideStatus() { 
  document.getElementById('status-message').classList.add('hidden'); 
}
