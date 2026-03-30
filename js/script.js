const API_KEY = 'C6Hk7NzJLuLlJuYSeXc389Sz6kdPAwGfUJaDeJ5J';
const FALLBACK_API_KEY = 'DEMO_KEY';
const APOD_ENDPOINT = 'https://api.nasa.gov/planetary/apod';
const FACTS = [
  'A day on Venus is longer than its year. Venus rotates so slowly that one full spin takes longer than one trip around the Sun.',
  'The International Space Station circles Earth about every 90 minutes, which means astronauts usually see multiple sunrises and sunsets each day.',
  'Neutron stars can pack more mass than the Sun into a sphere only about 12 miles wide.',
  'The Hubble Space Telescope does not stay still. It moves around Earth at roughly 17,000 miles per hour.',
  'Jupiter has faint rings, even though Saturn gets most of the ring-system attention.',
  'NASA scientists use light from distant galaxies to learn how the early universe changed over billions of years.'
];

const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const fetchButton = document.getElementById('fetchButton');
const gallery = document.getElementById('gallery');
const scrollPrevButton = document.getElementById('scrollPrev');
const scrollNextButton = document.getElementById('scrollNext');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const spaceFact = document.getElementById('spaceFact');
const modal = document.getElementById('modal');
const modalMedia = document.getElementById('modalMedia');
const modalDate = document.getElementById('modalDate');
const modalTitle = document.getElementById('modalTitle');
const modalExplanation = document.getElementById('modalExplanation');
const closeModalButton = document.getElementById('closeModal');
const latestStartDate = offsetDate(today, -8);
const earliestEndDate = offsetDate(earliestDate, 8);

setupDateInputs(startInput, endInput);
startInput.max = latestStartDate;
endInput.min = earliestEndDate;
setRandomFact();
syncDateRange('start');

fetchButton.addEventListener('click', loadApodGallery);
scrollPrevButton.addEventListener('click', () => scrollGallery(-1));
scrollNextButton.addEventListener('click', () => scrollGallery(1));
gallery.addEventListener('scroll', updateSliderButtons);
startInput.addEventListener('change', () => syncDateRange('start'));
endInput.addEventListener('change', () => syncDateRange('end'));
closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target.dataset.closeModal === 'true') {
    closeModal();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) {
    closeModal();
  }
});

loadApodGallery();
updateSliderButtons();

function syncDateRange(changedField) {
  const referenceDate = changedField === 'end' ? new Date(endInput.value) : new Date(startInput.value);
  if (Number.isNaN(referenceDate.getTime())) {
    return;
  }

  if (changedField === 'end') {
    const nextStart = new Date(referenceDate);
    nextStart.setDate(referenceDate.getDate() - 8);
    startInput.value = clampDate(nextStart.toISOString().split('T')[0], earliestDate, latestStartDate);
  } else {
    const nextEnd = new Date(referenceDate);
    nextEnd.setDate(referenceDate.getDate() + 8);
    endInput.value = clampDate(nextEnd.toISOString().split('T')[0], earliestEndDate, today);
  }
}

function clampDate(dateString, minDate, maxDate) {
  if (dateString < minDate) {
    return minDate;
  }

  if (dateString > maxDate) {
    return maxDate;
  }

  return dateString;
}

async function loadApodGallery() {
  setLoading(true);
  hideError();

  try {
    const items = await fetchApodData(API_KEY);

    if (!Array.isArray(items) || items.length !== 9) {
      throw new Error('NASA returned an unexpected number of entries for this 9-day range.');
    }

    renderGallery(items);
    setRandomFact();
  } catch (error) {
    renderPlaceholder('We could not load the NASA gallery for that date range. Please try again.');
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

async function fetchApodData(apiKey) {
  const url = new URL(APOD_ENDPOINT);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('start_date', startInput.value);
  url.searchParams.set('end_date', endInput.value);

  const response = await fetch(url);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const apiCode = payload?.error?.code;
    const apiMessage = payload?.error?.message;

    if (apiCode === 'API_KEY_INVALID' && apiKey !== FALLBACK_API_KEY) {
      return fetchApodData(FALLBACK_API_KEY);
    }

    throw new Error(apiMessage || 'NASA data request failed.');
  }

  if (!Array.isArray(payload)) {
    throw new Error('NASA returned an unexpected response.');
  }

  return [...payload].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderGallery(items) {
  gallery.innerHTML = items.map((item) => {
    const summary = truncateText(item.explanation, 130);
    const mediaMarkup = item.media_type === 'video'
      ? renderVideoMarkup(item, 'gallery')
      : `
        <div class="media-shell clickable-media" role="button" tabindex="0" data-date="${item.date}" aria-label="Open ${escapeHtml(item.title)} details">
          <img src="${item.url}" alt="${escapeHtml(item.title)}" loading="lazy" />
        </div>
      `;

    return `
      <article class="gallery-item">
        ${mediaMarkup}
        <div class="card-content">
          <p class="gallery-date">${formatDate(item.date)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="gallery-summary">${escapeHtml(summary)}</p>
          <button
            type="button"
            class="details-button"
            data-date="${item.date}"
          >
            Open Details
          </button>
        </div>
      </article>
    `;
  }).join('');

  gallery.querySelectorAll('.details-button').forEach((button, index) => {
    button.addEventListener('click', () => openModal(items[index]));
  });

  gallery.querySelectorAll('.clickable-media').forEach((mediaShell, index) => {
    mediaShell.addEventListener('click', () => openModal(items[index]));
    mediaShell.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(items[index]);
      }
    });
  });

  requestAnimationFrame(updateSliderButtons);
}

function renderVideoMarkup(item, context) {
  const safeTitle = escapeHtml(item.title);
  const isDirectVideo = isDirectVideoUrl(item.url);
  const mediaElement = isDirectVideo
      ? `
        <div class="media-shell clickable-media" role="button" tabindex="0" data-date="${item.date}" aria-label="Open ${escapeHtml(item.title)} details">
          <video ${context === 'gallery' ? 'muted' : 'controls'} playsinline ${context === 'gallery' ? 'preload="metadata"' : ''}>
            <source src="${item.url}" />
            Your browser does not support the video tag.
          </video>
          <span class="video-badge">Video</span>
        </div>
      `
      : `
        <div class="media-shell clickable-media" role="button" tabindex="0" data-date="${item.date}" aria-label="Open ${escapeHtml(item.title)} details">
          <iframe
            src="${item.url}"
            title="${safeTitle}"
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
          <span class="video-badge">Video</span>
        </div>
      `;

  return mediaElement;
}

function renderPlaceholder(message) {
  gallery.innerHTML = `
    <div class="placeholder">
      <div class="placeholder-icon">*</div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  updateSliderButtons();
}

function openModal(item) {
  modalDate.textContent = formatDate(item.date);
  modalTitle.textContent = item.title;
  modalExplanation.textContent = item.explanation;

  modalMedia.innerHTML = item.media_type === 'video'
    ? renderVideoMarkup(item, 'modal')
    : `<img src="${item.hdurl || item.url}" alt="${escapeHtml(item.title)}" />`;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modal.hidden = true;
  modalMedia.innerHTML = '';
  document.body.style.overflow = '';
}

function setLoading(isLoading) {
  loadingMessage.hidden = !isLoading;
  fetchButton.disabled = isLoading;
  fetchButton.textContent = isLoading ? 'Loading...' : 'Get Space Images';
}

function showError(message) {
  errorMessage.hidden = false;
  errorMessage.textContent = message;
}

function hideError() {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function setRandomFact() {
  const factIndex = Math.floor(Math.random() * FACTS.length);
  spaceFact.textContent = FACTS[factIndex];
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function escapeHtml(text) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return text.replace(/[&<>"']/g, (character) => replacements[character]);
}

function offsetDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

function scrollGallery(direction) {
  const firstCard = gallery.querySelector('.gallery-item');
  const scrollAmount = firstCard
    ? firstCard.getBoundingClientRect().width + 20
    : gallery.clientWidth * 0.9;

  gallery.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
}

function updateSliderButtons() {
  const maxScrollLeft = gallery.scrollWidth - gallery.clientWidth;
  const hasScrollableContent = maxScrollLeft > 10;

  scrollPrevButton.disabled = !hasScrollableContent || gallery.scrollLeft <= 10;
  scrollNextButton.disabled = !hasScrollableContent || gallery.scrollLeft >= maxScrollLeft - 10;
}
