'use strict';

const DATA = {
	index: 0,
	categories: [
		// { name: 'Fiction', books: [] },
	],
	results: [
		// { title, .... }
	],
	page: null, // search | category
};

// GLOBALS
const googleAjaxData = {
	url: 'https://www.googleapis.com/books/v1/volumes',
	data: {
		maxResults: 25,
		printType: 'books',
		startIndex: 0,
		key: 'AIzaSyAwzfIiAx2WQcQZcXxdRC3kkscWrLVnbMg',
	},
};

const NYTAjaxData = {
	url: 'https://api.nytimes.com/svc/books/v3/lists.json?api-key=ecb23c2aa6254b85b8623e1916c960f3',
	data: {
		list: '',
	},
};

const NYTSections = [
	'business-books',
	'science',
	// 'combined-print-and-e-book-fiction',
	// 'combined-print-and-e-book-nonfiction',
	// 'sports',
	// 'childrens-middle-grade-hardcover',
	// 'young-adult-hardcover',
];

function emit(eventName, payload) {
	switch (eventName) {
		case 'category-search-start':
			DATA.searchingCategories = true;
			break;
		case 'success-search':
			if (!DATA.searchingCategories) {
				storeResults(payload.data);
				render();
			}
			break;
		case 'success-category':
			storeCategory(payload.data, payload.category).then(() => {
				render();
				DATA.searchCategories = false;
			});
			break;
		case 'new-search':
			clearSearchResults();
			break;
	}
}

function getBooks(options, success) {
	let custom;
	let apiOptions;
	let name;
	if (options.category) {
		emit('category-search-start');
		name = 'category';
		apiOptions = NYTAjaxData;
		custom = {
			list: options.category,
		};
	} else if (options.search) {
		name = 'search';
		apiOptions = googleAjaxData;
		custom = {
			q: options.search,
			startIndex: DATA.index,
		};
	}

	$.ajax(
		Object.assign({
				dataType: 'json',
				success: data => {
					emit('success-' + name, {
						category: custom.list,
						data: data
					});
				},
			},
			apiOptions, {
				data: Object.assign(apiOptions.data, custom),
			}
		)
	);
}

function clearSearchResults() {
	DATA.results = [];
}

function storeResults(data) {
	DATA.results = DATA.results.concat(normalizeGoogleResults(data));
}

function normalizeGoogleResults(data) {
	const results = data.items.map((item, index) => {
		let book = normalizeGoogleBook(item);
		return book;
	});
	return results;
}

function normalizeGoogleBook(item) {
	let bookElement = {
		author: '',
		description: '',
		id: item.id,
		title: item.volumeInfo.title,
		thumbnail: 'https://image.ibb.co/bYtXH7/no_cover_en_US.jpg',
		isbn: null
	};

	if (item.volumeInfo.imageLinks) {
		bookElement.thumbnail = item.volumeInfo.imageLinks.thumbnail;
	}

	if (item.searchInfo) {
		bookElement.description = item.searchInfo.textSnippet;
	}

	if (item.volumeInfo.authors) {
		bookElement.author = item.volumeInfo.authors[0];
	}

	return bookElement;
}

function speechRecognition() {
	$('form').on('click', '.js-voice-search', function (event) {
		event.preventDefault();
		if (window.hasOwnProperty('webkitSpeechRecognition')) {
			var recognition = new webkitSpeechRecognition();
			recognition.continuous = false;
			recognition.interimResults = false;
			recognition.lang = 'en-US';
			recognition.start();
			recognition.onresult = function (e) {
				let query = e.results[0][0].transcript;
				recognition.stop();
				$('.search-field').val(query);
				emit('new-search');
				getBooks({
					search: query
				});
			};
			recognition.onerror = function (e) {
				recognition.stop();
			};
		}
	});
}

function infiniteScroll() {
	var win = $(window);
	win.scroll(function () {
		if (
			$(window).scrollTop() >=
			$(document).height() - $(window).height() - 10
		) {
			let query = $('.js-form').find('.search-field').val();
			if (query.length > 0) {
				DATA.index += 25;
				getBooks({
					search: query,
				});
			}
		}
	});
}

function lightboxHandler() {
	$('.book-container').on('click', 'img', function (event) {
		$('html').css('overflow', 'hidden');
	});

	$('.book-container').on('click', '.fa-close', function (event) {
		$('html').css('overflow', 'visible');
	});

	$(document).keyup(function (e) {
		if (location.hash !== '#_' && e.keyCode == 27) {
			location.hash = '#_';
			$('html').css('overflow', 'visible');
		}
	});
}

function isSearchFieldEmpty(search) {
	if (search === '') {
		return true;
	} else {
		return false;
	}
}

function initEventHandler() {
	// getBestSeller();

	$('.js-mainHeader').click(event => {
		$('form input').val('');
		getBestSeller();
	});

	$('.js-searchSubmit').click(event => {
		$('.js-form').submit();
	});

	$('.js-form').submit(event => {
		event.preventDefault();
		let query = $(event.currentTarget).find('.search-field').val();
		if (isSearchFieldEmpty(query)) {
			$('.search-field').removeClass('valid').addClass('invalid');
		} else {
			$('.search-field').removeClass('invalid').addClass('valid');
			emit('new-search');
			getBooks({
				search: query
			});

		}
	});

	lightboxHandler();
	infiniteScroll();
}

// NYT API
function storeCategory(data, category) {
	return normalizeNYTResults(data).then(results => {
		DATA.categories.append({
			category: category,
			results: results
		});
	});
}

function normalizeNYTResults(data) {
	return Promise.all(data.results.map((item, index) => {
		let isbnSearch = item.book_details[0].primary_isbn13;		
		return getBooks({
			search: `isbn:{isbnSearch}`
		}).then(result => {
			return normalizeNYTBook(item, result);
		});
	}));
}

function normalizeNYTBook(NYTItem, googleItem) {
	var bestSellerBook = {
		isbn: NYTItem.book_details[0].primary_isbn13,
		title: NYTItem.book_details[0].title,
		author: NYTItem.book_details[0].author,
		description: NYTItem.book_details[0].description,
		thumbnail: 'https://image.ibb.co/bYtXH7/no_cover_en_US.jpg',
	};

	if (googleItem.totalItems > 0 && googleItem.items[0].volumeInfo.imageLinks) {
		bestSellerBook.thumbnail =
			googleItem.items[0].volumeInfo.imageLinks.thumbnail;
	}

	return bestSellerBook;
}

function displayBestSellerData(name, results) {
	$(`section.${name} header`).html(renderBestSellerListName(listName));
	$(`section.${name} .books`).html(results.map(renderBestSellers));
}

function getBestSeller() {
	emit('category-search-start');
	NYTSections.forEach(section => {
		getBooks({
			category: section
		})
	})
}

// 	renderBestSellerBaseHTML();
// 	NYTSections.reduce((promise, name) => {
// 		return promise.then(() => {
// 			NYTAjaxData.data.list = name;
// 			return getBooksFromAPI(NYTAjaxData, displayBestSellerData(name));
// 		});
// 	}, Promise.resolve());

// RENDER
function renderSearchBook(book) {
	return `
    <div class="book col">
        <div class="bookItem w3-animate-opacity">                
            <a href='#${book.id || book.isbn}'>
                <img src="${book.thumbnail}" alt=${book.title}>                 
            </a>
            <p class="title">${book.title}</p>              
            <div class="lightbox" id="${book.id || book.isbn}">
                <div class="lightbox-content">
                    <a href="#_" class="fa fa-close fa-2x"></a>
                        <img src="${book.thumbnail}">
                    <h4>${book.title} <h6>by</h6> <h5>${book.author}</h5></h4>
                    <p class="book-description">${book.description}</p>
                </div>
            </div>        
        </div>      
    </div>        
    `;
}


function renderBestSellerBaseHTML() {
	NYTSections.forEach(name => {
		$('.book-container').append(`
            <section role="region" class=${name}>
                <header class="row bookListName">${name}</header>
                <div class="row books"></div>
            </section>
        `);
	});
}

function renderBestSellerListName(name) {
	return `
    <div class="book col w3-animate-opacity listName">      
        <h5>${name}</h5>                  
    </div>
    `;
}

function render() {
	const results = DATA.results;
	$('.book-container').html(results.map(renderSearchBook));
}

function renderEmptyContainer() {
	$('.book-container').empty();
}

// ON PAGE LOAD
function onLoadTrigger() {
	initEventHandler();
	speechRecognition();
}

$(onLoadTrigger());