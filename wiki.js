let wiki = require('wikijs').default;
let { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Helper funkciók a references javításához
function extractSmartLinkName(url) {
    try {
        let urlObj = new URL(url);
        let domain = urlObj.hostname.replace('www.', '').toLowerCase();
        let pathname = urlObj.pathname;
        let searchParams = urlObj.searchParams;
        
        // 1. Próbáljuk a pathname-ből kinyerni a címet
        let titleFromPath = extractTitleFromPath(pathname);
        if (titleFromPath) {
            let domainName = getCleanDomainName(domain);
            return `${titleFromPath} - ${domainName}`;
        }
        
        // 2. Ha van search param, ami címre utal
        let titleFromParams = extractTitleFromParams(searchParams);
        if (titleFromParams) {
            let domainName = getCleanDomainName(domain);
            return `${titleFromParams} - ${domainName}`;
        }
        
        // 3. Domain alapú intelligens név
        return getIntelligentDomainName(domain);
        
    } catch (e) {
        return 'External Link';
    }
}

function extractTitleFromPath(pathname) {
    if (!pathname || pathname.length <= 1) return null;
    
    let pathParts = pathname.split('/').filter(part => part && part.length > 1);
    if (pathParts.length === 0) return null;
    
    // Utolsó értelmes rész keresése
    for (let i = pathParts.length - 1; i >= 0; i--) {
        let part = pathParts[i];
        
        // Kihagyjuk a fájl extensionokat és az ID-szerű dolgokat
        if (part.includes('.html') || part.includes('.pdf') || 
            part.includes('.php') || /^\d+$/.test(part) || 
            part.length < 3) continue;
            
        // Tisztítjuk és feldolgozzuk
        let cleaned = part
            .replace(/[-_]/g, ' ')
            .replace(/\+/g, ' ')
            .replace(/%20/g, ' ')
            .trim();
            
        // Ha értelmes hosszú és nem csak számok/speciális karakterek
        if (cleaned.length >= 4 && cleaned.length <= 60 && 
            /[a-zA-Z]/.test(cleaned) && 
            cleaned.split(' ').length <= 8) {
            
            return cleaned.split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }
    }
    
    return null;
}

function extractTitleFromParams(searchParams) {
    // Gyakori URL paraméterek, amik címet tartalmazhatnak
    let titleParams = ['title', 'q', 'query', 'search', 'article', 'page', 'name'];
    
    for (let param of titleParams) {
        let value = searchParams.get(param);
        if (value && value.length >= 4 && value.length <= 60) {
            let cleaned = decodeURIComponent(value)
                .replace(/[-_+]/g, ' ')
                .trim();
                
            if (/[a-zA-Z]/.test(cleaned) && cleaned.split(' ').length <= 8) {
                return cleaned.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            }
        }
    }
    
    return null;
}

function getIntelligentDomainName(domain) {
    let parts = domain.split('.');
    
    // Altdomainek kezelése (pl. en.wikipedia.org -> Wikipedia EN)
    if (parts.length >= 3) {
        let subdomain = parts[0];
        let mainDomain = parts[1];
        
        // Ha a subdomain nyelvkód vagy értelmes prefix
        if (isLanguageCode(subdomain)) {
            return `${capitalize(mainDomain)} (${subdomain.toUpperCase()})`;
        } else if (subdomain.length <= 8 && /^[a-z]+$/.test(subdomain)) {
            return `${capitalize(subdomain)} ${capitalize(mainDomain)}`;
        }
    }
    
    // Fő domain név tisztítása
    let mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    
    // TLD alapú kategorizálás
    let tld = parts[parts.length - 1];
    let suffix = '';
    if (tld === 'gov') suffix = ' (Government)';
    else if (tld === 'edu') suffix = ' (Education)';
    else if (tld === 'org') suffix = ' (Organization)';
    else if (tld === 'mil') suffix = ' (Military)';
    
    // Speciális rövidítések felismerése
    if (mainPart.length <= 4 && /^[a-z]+$/.test(mainPart)) {
        return mainPart.toUpperCase() + suffix;
    }
    
    // Normál domain név tisztítása
    let cleanName = mainPart
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => capitalize(word))
        .join(' ');
        
    return cleanName + suffix;
}

function getCleanDomainName(domain) {
    let parts = domain.split('.');
    let mainPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    
    if (mainPart.length <= 4) {
        return mainPart.toUpperCase();
    }
    
    return capitalize(mainPart);
}

function extractTitleFromText(ref) {
    // Közös hivatkozási minták felismerése
    let patterns = [
        // "Szerző (év): Cím"
        /^[^:]+:\s*(.+?)(?:\.|$)/,
        // "Cím. Szerző..."
        /^(.+?)\.\s+[A-Z][a-z]+/,
        // "Cím (év)"
        /^(.+?)\s*\(\d{4}\)/,
        // Egyszerű cím pontig
        /^(.+?)\./
    ];
    
    for (let pattern of patterns) {
        let match = ref.match(pattern);
        if (match && match[1]) {
            let title = match[1].trim();
            
            // Ellenőrizzük, hogy értelmes cím-e
            if (title.length >= 10 && title.length <= 100 && 
                title.split(' ').length >= 2 && 
                title.split(' ').length <= 15) {
                
                return title.length > 80 ? title.substring(0, 77) + '...' : title;
            }
        }
    }
    
    // Ha semmi nem illeszkedik, limitáljuk az eredeti szöveget
    return ref.length > 100 ? ref.substring(0, 97) + '...' : ref;
}

// Segédfunkciók
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function isLanguageCode(code) {
    // Gyakori 2-3 betűs nyelvkódok
    let langCodes = /^(en|hu|de|fr|es|it|ru|ja|zh|pt|nl|pl|sv|no|da|fi|ko|tr|ar|he|hi|th|vi|uk|el|ca|cs|bg|hr|et|lv|lt|mt|ro|sk|sl)$/i;
    return langCodes.test(code);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wiki')
        .setDescription('🔎 Search something on Wikipedia')
        .addStringOption(option => 
            option.setName('search')
                .setDescription('What would you like to search on Wikipedia?')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('language')
                .setDescription('Wikipedia language (default: en)')
                .setRequired(false)
                .addChoices(
                    { name: '🇬🇧 English', value: 'en' },
                    { name: '🇭🇺 Magyar', value: 'hu' },
                    { name: '🇩🇪 Deutsch', value: 'de' },
                    { name: '🇫🇷 Français', value: 'fr' },
                    { name: '🇪🇸 Español', value: 'es' },
                    { name: '🇮🇹 Italiano', value: 'it' },
                    { name: '🇷🇺 Русский', value: 'ru' },
                    { name: '🇯🇵 日本語', value: 'ja' },
                    { name: '🇨🇳 中文', value: 'zh' },
                    { name: '🇵🇹 Português', value: 'pt' },
                    { name: '🇳🇱 Nederlands', value: 'nl' },
                    { name: '🇵🇱 Polski', value: 'pl' },
                    { name: '🇸🇪 Svenska', value: 'sv' },
                    { name: '🇳🇴 Norsk', value: 'no' },
                    { name: '🇩🇰 Dansk', value: 'da' },
                    { name: '🇫🇮 Suomi', value: 'fi' },
                    { name: '🇰🇷 한국어', value: 'ko' },
                    { name: '🇹🇷 Türkçe', value: 'tr' },
                    { name: '🇦🇷 العربية', value: 'ar' },
                    { name: '🇮🇱 עברית', value: 'he' },
                    { name: '🇮🇳 हिन्दी', value: 'hi' },
                    { name: '🇹🇭 ไทย', value: 'th' },
                    { name: '🇻🇳 Tiếng Việt', value: 'vi' },
                    { name: '🇺🇦 Українська', value: 'uk' },
                    { name: '🇬🇷 Ελληνικά', value: 'el' }
                )
        ),
    async execute(interaction) {
        let query = interaction.options.getString('search');
        let language = interaction.options.getString('language') || 'en';
        
        await interaction.deferReply();

        try {
            // Wikipedia instance létrehozása
            let wikiInstance;
            let supportedLanguages = ['en', 'hu', 'de', 'fr', 'es', 'it', 'ru', 'ja', 'zh', 'pt', 'nl', 'pl', 'sv', 'no', 'da', 'fi', 'ko', 'tr', 'ar', 'he', 'hi', 'th', 'vi', 'uk', 'el'];
            
            if (supportedLanguages.includes(language)) {
                try {
                    wikiInstance = wiki({ apiUrl: `https://${language}.wikipedia.org/w/api.php` });
                    let testSearch = await wikiInstance.search(query);
                } catch (langError) {
                    console.log(`Language ${language} failed, falling back to English`);
                    wikiInstance = wiki();
                }
            } else {
                wikiInstance = wiki();
            }
            
            // Keresés végrehajtása
            let searchResults = await wikiInstance.search(query);

            if (!searchResults.results || searchResults.results.length === 0) {
                let noResultEmbed = new EmbedBuilder()
                    .setColor('#FF6B6B')
                    .setTitle('🚫 No Results Found')
                    .setDescription(`Sorry, I couldn't find anything about **"${query}"** on Wikipedia.`)
                    .addFields({
                        name: '💡 Suggestions',
                        value: '• Check your spelling\n• Try different keywords\n• Use more general terms\n• Try searching in English',
                        inline: false
                    })
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png')
                    .setFooter({ 
                        text: `Wikipedia Search (${language.toUpperCase()}) • Requested by ${interaction.user.tag || interaction.user.id}`, 
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                    })
                    .setTimestamp();
                
                return await interaction.editReply({ embeds: [noResultEmbed]});
            }

            // Az első találat részletes adatainak lekérése
            let page = await wikiInstance.page(searchResults.results[0]);
            let summary = await page.summary();
            let pageUrl = page.url();
            
            // Részletes adatok lekérése
            let mainImage = null;
            let categories = [];
            let coordinates = null;
            let infobox = null;
            let images = [];
            let references = [];
            let langlinks = [];
            
            try { mainImage = await page.mainImage(); } catch (e) { console.log('No main image'); }
            try { categories = await page.categories(); } catch (e) { console.log('No categories'); }
            try { coordinates = await page.coordinates(); } catch (e) { console.log('No coordinates'); }
            //try { infobox = await page.infobox(); } catch (e) { console.log('No infobox'); }
            try { 
                let allImages = await page.images(); 
                // Filter to only Discord-supported image formats
                const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                images = allImages.filter(imageUrl => {
                    let lowerUrl = imageUrl.toLowerCase();
                    return supportedFormats.some(format => lowerUrl.includes(format));
                });
            } catch (e) { console.log('No images'); }
            try { references = await page.references(); } catch (e) { console.log('No references'); }
            try { langlinks = await page.langlinks(); } catch (e) { console.log('No langlinks'); }

            // Summary feldolgozása lapozáshoz
            let cleanSummary = summary
                .replace(/\n\n+/g, '\n\n')
                .replace(/\([^)]*\)/g, '')
                .trim();

            // Text chunking intelligensen - bekezdések szerint
            let paragraphs = cleanSummary.split('\n\n');
            let chunks = [];
            let currentChunk = '';
            
            for (let paragraph of paragraphs) {
                if ((currentChunk + paragraph).length > 1500) {
                    if (currentChunk) {
                        chunks.push(currentChunk.trim());
                        currentChunk = paragraph;
                    } else {
                        // Ha egy bekezdés túl hosszú, feldaraboljuk
                        let sentences = paragraph.split('. ');
                        let sentenceChunk = '';
                        for (let sentence of sentences) {
                            if ((sentenceChunk + sentence).length > 1500) {
                                if (sentenceChunk) {
                                    chunks.push(sentenceChunk.trim() + '.');
                                    sentenceChunk = sentence;
                                } else {
                                    chunks.push(sentence.substring(0, 1500) + '...');
                                }
                            } else {
                                sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
                            }
                        }
                        if (sentenceChunk) currentChunk = sentenceChunk + '.';
                    }
                } else {
                    currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
                }
            }
            if (currentChunk) chunks.push(currentChunk.trim());

            // References chunking
            let referencesChunks = [];
            if (references.length > 0) {
                let referencesPerPage = 10;
                for (let i = 0; i < references.length; i += referencesPerPage) {
                    referencesChunks.push(references.slice(i, i + referencesPerPage));
                }
            }

            // Embed színe kategória alapján
            let embedColor = '#0066CC';
            if (categories.length > 0) {
                let category = categories[0].toLowerCase();
                if (category.includes('people') || category.includes('person') || category.includes('birth')) embedColor = '#FF6B9D';
                else if (category.includes('place') || category.includes('location') || category.includes('cities')) embedColor = '#4CAF50';
                else if (category.includes('science') || category.includes('technology')) embedColor = '#9C27B0';
                else if (category.includes('history') || category.includes('event')) embedColor = '#FF9800';
                else if (category.includes('culture') || category.includes('art')) embedColor = '#E91E63';
            }

            // View mode és lapozás változók
            let viewMode = 'text'; // 'text', 'images', 'references', 'summary'
            let currentPage = 0;
            let totalPages = Math.max(1, chunks.length);
            let imageCurrentPage = 0;
            let imageTotalPages = Math.max(1, images.length);
            let referencesCurrentPage = 0;
            let referencesTotalPages = Math.max(1, referencesChunks.length);

            // Helper funkció a field értékek limitálásához (Discord limit: 1024 karakter)
            let limitFieldValue = (text, maxLength = 1020) => {
                if (text.length <= maxLength) return text;
                return text.substring(0, maxLength - 3) + '...';
            };

            // Lapozható embed rendszer
            let generateEmbed = (pageIndex, mode = 'text') => {
                let embed = new EmbedBuilder()
                    .setColor(embedColor)
                    .setTitle(`📖 ${page.raw.title}`)
                    .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png');

                if (mode === 'text') {
                    // Normál wiki tartalom
                    embed.setURL(pageUrl);
                    
                    // Tartalmi lapok
                    if (pageIndex < chunks.length) {
                        embed.setDescription(limitFieldValue(chunks[pageIndex], 4090));
                    }
                    
                    // Első lap - extra információk
                    if (pageIndex === 0) {
                        // Fő kép hozzáadása
                        if (mainImage && mainImage.includes('http')) {
                            embed.setImage(mainImage);
                        }
                        
                        // Infobox információk
                        if (infobox && Object.keys(infobox).length > 0) {
                            let infoFields = '';
                            let entries = Object.entries(infobox).slice(0, 3);
                            
                            for (let [key, value] of entries) {
                                let field = `**${key}**: ${value}`;
                                let newText = infoFields ? `${infoFields}\n${field}` : field;
                                
                                if (newText.length > 1000) break;
                                infoFields = newText;
                            }
                            
                            if (infoFields) {
                                embed.addFields({
                                    name: '📊 Quick Facts',
                                    value: limitFieldValue(infoFields),
                                    inline: false
                                });
                            }
                        }
                        
                        // Koordináták
                        if (coordinates && coordinates.lat && coordinates.lon) {
                            embed.addFields({
                                name: '📍 Coordinates',
                                value: `[${coordinates.lat.toFixed(4)}, ${coordinates.lon.toFixed(4)}](https://www.google.com/maps?q=${coordinates.lat},${coordinates.lon})`,
                                inline: true
                            });
                        }
                    }
                    
                    // Utolsó lap - meta információk
                    if (pageIndex === totalPages - 1) {
                        // Kategóriák
                        if (categories.length > 0) {
                            let categoryText = '';
                            let maxCategories = 8;
                            
                            // Kategóriák hozzáadása egyenként, amíg nem lépjük túl a limitet
                            for (let i = 0; i < Math.min(categories.length, maxCategories); i++) {
                                let cat = categories[i];
                                let cleanCat = cat.replace('Category:', '').replace('Kategória:', '');
                                let encodedCat = encodeURIComponent(cat);
                                let catLink = `[${cleanCat}](https://${language}.wikipedia.org/wiki/${encodedCat})`;
                                
                                let newText = categoryText ? `${categoryText} • ${catLink}` : catLink;
                                
                                // Ellenőrizzük, hogy nem lépjük-e túl a limitet
                                if (newText.length > 900) {
                                    if (categories.length > i) {
                                        // Direktebb link a kategóriákhoz - catlinks a Wikipedia standard
                                        categoryText += ` • [+${categories.length - i} more categories...](${pageUrl}#catlinks)`;
                                    }
                                    break;
                                }
                                categoryText = newText;
                            }
                            
                            if (categoryText) {
                                embed.addFields({
                                    name: '🏷️ Categories',
                                    value: limitFieldValue(categoryText),
                                    inline: false
                                });
                            }
                        }
                        
                        // További találatok - linkekkel
                        if (searchResults.results.length > 1) {
                            let additionalResults = '';
                            let maxResults = 6;
                            
                            for (let i = 1; i < Math.min(searchResults.results.length, maxResults); i++) {
                                let result = searchResults.results[i];
                                let encodedTitle = encodeURIComponent(result.replace(/ /g, '_'));
                                let resultLink = `${i + 1}. [${result}](https://${language}.wikipedia.org/wiki/${encodedTitle})`;
                                
                                let newText = additionalResults ? `${additionalResults}\n${resultLink}` : resultLink;
                                
                                // Ellenőrizzük a limitet
                                if (newText.length > 1000) {
                                    if (searchResults.results.length > i) {
                                        additionalResults += `\n[+${searchResults.results.length - i} more results...](${pageUrl})`;
                                    }
                                    break;
                                }
                                additionalResults = newText;
                            }
                            
                            if (additionalResults) {
                                embed.addFields({
                                    name: '🔍 Related Articles',
                                    value: limitFieldValue(additionalResults),
                                    inline: false
                                });
                            }
                        }
                        
                        // Képek száma - linkkel
                        if (images.length > 0) {
                            embed.addFields({
                                name: '🖼️ Images Available',
                                value: `[${images.length} images on Wikipedia](${pageUrl}#/media/)`,
                                inline: true
                            });
                        }
                        
                        // Hivatkozások száma - linkkel
                        if (references.length > 0) {
                            embed.addFields({
                                name: '📚 References',
                                value: `[${references.length} references](${pageUrl}#References)`,
                                inline: true
                            });
                        }
                    }

                    embed.setFooter({ 
                        text: `Wikipedia (${language.toUpperCase()}) • Page ${pageIndex + 1}/${totalPages} • Requested by ${interaction.user.tag || interaction.user.id}`, 
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                    });

                } else if (mode === 'images') {
                    // Képek mód
                    embed.setTitle(`🖼️ Images: ${page.raw.title}`)
                        .setURL(pageUrl);
                    
                    if (images.length > 0 && imageCurrentPage < images.length) {
                        let currentImage = images[imageCurrentPage];
                        let description = `**Image ${imageCurrentPage + 1} of ${images.length}**\n\n[View full size image](${currentImage})\n[All images on Wikipedia](${pageUrl}#/media/)`;
                        embed.setImage(currentImage)
                            .setDescription(limitFieldValue(description, 4090));
                    } else {
                        embed.setDescription('No images available for this article.');
                    }

                    embed.setFooter({ 
                        text: `Wikipedia Images (${language.toUpperCase()}) • Image ${imageCurrentPage + 1}/${imageTotalPages} • Requested by ${interaction.user.tag || interaction.user.id}`, 
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                    });

                } else if (mode === 'references') {
                    // References mód
                    embed.setTitle(`📚 References: ${page.raw.title}`)
                        .setURL(pageUrl);
                    
                    if (referencesChunks.length > 0 && referencesCurrentPage < referencesChunks.length) {
                        let currentReferences = referencesChunks[referencesCurrentPage];
                        
                        // JAVÍTOTT RÉSZ - dinamikus references feldolgozás
                        let referencesText = currentReferences
                            .map((ref, index) => {
                                let refIndex = (referencesCurrentPage * 10) + index + 1;
                                
                                if (ref.startsWith('http')) {
                                    let linkName = extractSmartLinkName(ref);
                                    return `${refIndex}. [${linkName}](${ref})`;
                                } else {
                                    let processedRef = extractTitleFromText(ref);
                                    return `${refIndex}. ${processedRef}`;
                                }
                            })
                            .join('\n');
                        
                        let description = `**References ${(referencesCurrentPage * 10) + 1}-${Math.min((referencesCurrentPage + 1) * 10, references.length)} of ${references.length}**\n\n${referencesText}\n\n[View all references on Wikipedia](${pageUrl}#References)`;
                        
                        embed.setDescription(limitFieldValue(description, 4090));
                    } else {
                        embed.setDescription('No references available for this article.');
                    }

                    embed.setFooter({ 
                        text: `Wikipedia References (${language.toUpperCase()}) • Page ${referencesCurrentPage + 1}/${referencesTotalPages} • Requested by ${interaction.user.tag || interaction.user.id}`, 
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                    });

                } else if (mode === 'summary') {
                    // Összefoglaló mód
                    embed.setTitle(`📄 Summary: ${page.raw.title}`)
                        .setURL(pageUrl)
                        .setDescription(limitFieldValue(cleanSummary.substring(0, 1000) + (cleanSummary.length > 1000 ? '...' : ''), 4090));
                    
                    // Alapvető statisztikák - linkekkel
                    let statsValue = `**Length:** [${cleanSummary.length} characters](${pageUrl})\n**Pages:** [${totalPages} pages](${pageUrl})\n**Categories:** [${categories.length} categories](${pageUrl}#Categories)`;
                    let mediaValue = `**Images:** [${images.length} available](${pageUrl}#/media/)\n**References:** [${references.length} sources](${pageUrl}#References)\n**Languages:** [${langlinks.length} available](${pageUrl}#Languages)`;
                    
                    embed.addFields(
                        { name: '📊 Article Statistics', value: statsValue, inline: true },
                        { name: '📈 Media & References', value: mediaValue, inline: true }
                    );
                    
                    // További találatok - linkekkel
                    if (searchResults.results.length > 1) {
                        let additionalResults = '';
                        let maxResults = 6;
                        
                        for (let i = 1; i < Math.min(searchResults.results.length, maxResults); i++) {
                            let result = searchResults.results[i];
                            let encodedTitle = encodeURIComponent(result.replace(/ /g, '_'));
                            let resultLink = `${i + 1}. [${result}](https://${language}.wikipedia.org/wiki/${encodedTitle})`;
                            
                            let newText = additionalResults ? `${additionalResults}\n${resultLink}` : resultLink;
                            
                            // Ellenőrizzük a limitet
                            if (newText.length > 1000) {
                                if (searchResults.results.length > i) {
                                    additionalResults += `\n[+${searchResults.results.length - i} more results...](${pageUrl})`;
                                }
                                break;
                            }
                            additionalResults = newText;
                        }
                        
                        if (additionalResults) {
                            embed.addFields({
                                name: '🔍 Related Articles',
                                value: limitFieldValue(additionalResults),
                                inline: false
                            });
                        }
                    }
                    
                    // Wikipedia link
                    embed.addFields({
                        name: '🔗 Full Article',
                        value: `[Open "${page.raw.title}" article on Wikipedia](${pageUrl})`,
                        inline: false
                    });

                    embed.setFooter({ 
                        text: `Wikipedia Summary (${language.toUpperCase()}) • Requested by ${interaction.user.tag || interaction.user.id}`, 
                        iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                    });
                }

                embed.setTimestamp();
                return embed;
            };

            let generateButtons = (pageIndex, mode = 'text') => {
                let row = new ActionRowBuilder();
                
                if (mode === 'text') {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('wiki_first')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === 0),
                        new ButtonBuilder()
                            .setCustomId('wiki_prev')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === 0),
                        new ButtonBuilder()
                            .setCustomId('wiki_info')
                            .setLabel(`${pageIndex + 1}/${totalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('wiki_next')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === totalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('wiki_last')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === totalPages - 1)
                    );
                } else if (mode === 'images') {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('wiki_img_first')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(imageCurrentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('wiki_img_prev')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(imageCurrentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('wiki_img_info')
                            .setLabel(`${imageCurrentPage + 1}/${imageTotalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('wiki_img_next')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(imageCurrentPage === imageTotalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('wiki_img_last')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(imageCurrentPage === imageTotalPages - 1)
                    );
                } else if (mode === 'references') {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('wiki_ref_first')
                            .setEmoji('⏮️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(referencesCurrentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('wiki_ref_prev')
                            .setEmoji('◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(referencesCurrentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('wiki_ref_info')
                            .setLabel(`${referencesCurrentPage + 1}/${referencesTotalPages}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true),
                        new ButtonBuilder()
                            .setCustomId('wiki_ref_next')
                            .setEmoji('▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(referencesCurrentPage === referencesTotalPages - 1),
                        new ButtonBuilder()
                            .setCustomId('wiki_ref_last')
                            .setEmoji('⏭️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(referencesCurrentPage === referencesTotalPages - 1)
                    );
                } else {
                    // Summary mode - no navigation needed
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('wiki_placeholder')
                            .setLabel('Summary View')
                            .setEmoji('📄')
                            .setStyle(ButtonStyle.Success)
                            .setDisabled(true)
                    );
                }

                let row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('wiki_home')
                            .setLabel('Home')
                            .setEmoji('🏠')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(mode === 'text'),
                        new ButtonBuilder()
                            .setCustomId('wiki_images')
                            .setLabel('Images')
                            .setEmoji('🖼️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(images.length === 0 || mode === 'images'),
                        new ButtonBuilder()
                            .setCustomId('wiki_references')
                            .setLabel('References')
                            .setEmoji('📚')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(references.length === 0 || mode === 'references'),
                        new ButtonBuilder()
                            .setCustomId('wiki_summary')
                            .setLabel('Summary')
                            .setEmoji('📄')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(mode === 'summary'),
                        new ButtonBuilder()
                            .setCustomId('wiki_search_new')
                            .setLabel('New Search')
                            .setEmoji('🔍')
                            .setStyle(ButtonStyle.Secondary)
                    );

                // Language dropdown - csak ha van elérhető nyelv
                let languageMap = {
                    'en': '🇬🇧 English', 'hu': '🇭🇺 Magyar', 'de': '🇩🇪 Deutsch', 'fr': '🇫🇷 Français',
                    'es': '🇪🇸 Español', 'it': '🇮🇹 Italiano', 'ru': '🇷🇺 Русский', 'ja': '🇯🇵 日本語',
                    'zh': '🇨🇳 中文', 'pt': '🇵🇹 Português', 'nl': '🇳🇱 Nederlands', 'pl': '🇵🇱 Polski',
                    'sv': '🇸🇪 Svenska', 'no': '🇳🇴 Norsk', 'da': '🇩🇰 Dansk', 'fi': '🇫🇮 Suomi',
                    'ko': '🇰🇷 한국어', 'tr': '🇹🇷 Türkçe', 'ar': '🇦🇷 العربية', 'he': '🇮🇱 עברית',
                    'hi': '🇮🇳 हिन्दी', 'th': '🇹🇭 ไทย', 'vi': '🇻🇳 Tiếng Việt', 'uk': '🇺🇦 Українська', 'el': '🇬🇷 Ελληνικά'
                };

                let components = [row, row2];

                // Nyelvek dropdown hozzáadása, ha van elérhető
                if (langlinks && langlinks.length > 0) {
                    let availableLanguages = langlinks
                        .filter(link => supportedLanguages.includes(link.lang) && link.lang !== language)
                        .slice(0, 20)
                        .map(link => ({
                            label: languageMap[link.lang] || `${link.lang.toUpperCase()}`,
                            value: `lang_${link.lang}`,
                            description: `Read "${link.title}" in ${link.lang.toUpperCase()}`,
                            emoji: languageMap[link.lang]?.split(' ')[0] || '🌐'
                        }));

                    if (availableLanguages.length > 0) {
                        availableLanguages.unshift({
                            label: languageMap[language] || language.toUpperCase(),
                            value: `lang_${language}`,
                            description: `Current language`,
                            emoji: '✅'
                        });

                        let row3 = new ActionRowBuilder()
                            .addComponents(
                                new StringSelectMenuBuilder()
                                    .setCustomId('wiki_language_select')
                                    .setPlaceholder('🌐 Available in other languages')
                                    .addOptions(availableLanguages)
                            );

                        //components.push(row3);
                        components.splice(1, 0, row3);
                    }
                }

                return components;
            };

            // Kezdeti válasz küldése
            let components = generateButtons(currentPage, viewMode);
            let message = await interaction.editReply({
                embeds: [generateEmbed(currentPage, viewMode)],
                components: components
            });

            // Button és Select Menu collector
            let collector = message.createMessageComponentCollector({
                filter: (componentInteraction) => {
                    return (componentInteraction.customId.startsWith('wiki_') || componentInteraction.customId === 'wiki_language_select');
                }
                // No timeout - collector runs indefinitely
            });

            collector.on('collect', async (componentInteraction) => {
                try {
/*                     if (componentInteraction.user.id !== interaction.user.id) {
                        await componentInteraction.reply({ 
                            content: '❌ Only the person who used the command can navigate!', 
                            ephemeral: true 
                        });
                        return;
                    } */

                    // New Search Modal kezelése
                    if (componentInteraction.customId === 'wiki_search_new') {
                        let modal = new ModalBuilder()
                            .setCustomId('wiki_search_modal')
                            .setTitle('🔍 Wikipedia Search');

                        let searchInput = new TextInputBuilder()
                            .setCustomId('wiki_search_input')
                            .setLabel('Wiki Search')
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder('Enter your search term...')
                            .setRequired(true)
                            .setMinLength(1)
                            .setMaxLength(100);

                        let actionRow = new ActionRowBuilder().addComponents(searchInput);
                        modal.addComponents(actionRow);

                        await componentInteraction.showModal(modal);
                        return;
                    }

                    // Language select menu kezelése
                    if (componentInteraction.customId === 'wiki_language_select') {
                        let selectedLang = componentInteraction.values[0].replace('lang_', '');
                        
                        if (selectedLang === language) {
                            await componentInteraction.reply({ 
                                content: '✅ You are already viewing this article in the selected language!', 
                                ephemeral: true 
                            });
                            return;
                        }

                        // Loading állapot jelzés
                        let loadingEmbed = new EmbedBuilder()
                            .setColor('#FFA500')
                            .setTitle('🔄 Switching Language...')
                            .setDescription(`Loading article in **${selectedLang.toUpperCase()}**...`)
                            .addFields({
                                name: '⏳ Please wait',
                                value: 'Fetching content from Wikipedia...',
                                inline: false
                            })
                            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png')
                            .setFooter({ 
                                text: `Wikipedia Language Switch • ${interaction.user.tag || interaction.user.id}`, 
                                iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                            });

                        await componentInteraction.update({
                            embeds: [loadingEmbed],
                            components: []
                        });
                        
                        // Új nyelvi keresés és teljes embed frissítés
                        try {
                            let newWikiInstance = wiki({ apiUrl: `https://${selectedLang}.wikipedia.org/w/api.php` });
                            let newSearchResults = await newWikiInstance.search(query);
                            
                            if (newSearchResults.results && newSearchResults.results.length > 0) {
                                // Új oldal betöltése
                                let newPage = await newWikiInstance.page(newSearchResults.results[0]);
                                let newSummary = await newPage.summary();
                                let newPageUrl = newPage.url();
                                
                                // Új részletes adatok lekérése
                                let newMainImage = null;
                                let newCategories = [];
                                let newCoordinates = null;
                                let newInfobox = null;
                                let newImages = [];
                                let newReferences = [];
                                let newLanglinks = [];
                                
                                try { newMainImage = await newPage.mainImage(); } catch (e) { console.log('No main image'); }
                                try { newCategories = await newPage.categories(); } catch (e) { console.log('No categories'); }
                                try { newCoordinates = await newPage.coordinates(); } catch (e) { console.log('No coordinates'); }
                                //try { newInfobox = await newPage.infobox(); } catch (e) { console.log('No infobox'); }
                                try { 
                                    let allNewImages = await newPage.images(); 
                                    // Filter to only Discord-supported image formats
                                    const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                                    newImages = allNewImages.filter(imageUrl => {
                                        let lowerUrl = imageUrl.toLowerCase();
                                        return supportedFormats.some(format => lowerUrl.includes(format));
                                    });
                                } catch (e) { console.log('No images'); }
                                try { newReferences = await newPage.references(); } catch (e) { console.log('No references'); }
                                try { newLanglinks = await newPage.langlinks(); } catch (e) { console.log('No langlinks'); }

                                // Globális változók frissítése
                                wikiInstance = newWikiInstance;
                                page = newPage;
                                pageUrl = newPageUrl;
                                mainImage = newMainImage;
                                categories = newCategories;
                                coordinates = newCoordinates;
                                infobox = newInfobox;
                                images = newImages;
                                references = newReferences;
                                langlinks = newLanglinks;
                                language = selectedLang;
                                searchResults = newSearchResults;
                                
                                // Summary feldolgozása az új nyelvre
                                let newCleanSummary = newSummary
                                    .replace(/\n\n+/g, '\n\n')
                                    .replace(/\([^)]*\)/g, '')
                                    .trim();

                                cleanSummary = newCleanSummary;

                                // Text chunking újra az új tartalomra
                                let newParagraphs = newCleanSummary.split('\n\n');
                                let newChunks = [];
                                let newCurrentChunk = '';
                                
                                for (let paragraph of newParagraphs) {
                                    if ((newCurrentChunk + paragraph).length > 1500) {
                                        if (newCurrentChunk) {
                                            newChunks.push(newCurrentChunk.trim());
                                            newCurrentChunk = paragraph;
                                        } else {
                                            let sentences = paragraph.split('. ');
                                            let sentenceChunk = '';
                                            for (let sentence of sentences) {
                                                if ((sentenceChunk + sentence).length > 1500) {
                                                    if (sentenceChunk) {
                                                        newChunks.push(sentenceChunk.trim() + '.');
                                                        sentenceChunk = sentence;
                                                    } else {
                                                        newChunks.push(sentence.substring(0, 1500) + '...');
                                                    }
                                                } else {
                                                    sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
                                                }
                                            }
                                            if (sentenceChunk) newCurrentChunk = sentenceChunk + '.';
                                        }
                                    } else {
                                        newCurrentChunk += (newCurrentChunk ? '\n\n' : '') + paragraph;
                                    }
                                }
                                if (newCurrentChunk) newChunks.push(newCurrentChunk.trim());
                                
                                chunks = newChunks;
                                totalPages = Math.max(1, chunks.length);
                                imageTotalPages = Math.max(1, images.length);
                                
                                // References chunking újra
                                let newReferencesChunks = [];
                                if (newReferences.length > 0) {
                                    let referencesPerPage = 10;
                                    for (let i = 0; i < newReferences.length; i += referencesPerPage) {
                                        newReferencesChunks.push(newReferences.slice(i, i + referencesPerPage));
                                    }
                                }
                                referencesChunks = newReferencesChunks;
                                referencesTotalPages = Math.max(1, referencesChunks.length);
                                
                                currentPage = 0;
                                imageCurrentPage = 0;
                                referencesCurrentPage = 0;
                                viewMode = 'text';
                                
                                // Embed színe újra a kategóriák alapján
                                if (newCategories.length > 0) {
                                    let category = newCategories[0].toLowerCase();
                                    if (category.includes('people') || category.includes('person') || category.includes('birth')) embedColor = '#FF6B9D';
                                    else if (category.includes('place') || category.includes('location') || category.includes('cities')) embedColor = '#4CAF50';
                                    else if (category.includes('science') || category.includes('technology')) embedColor = '#9C27B0';
                                    else if (category.includes('history') || category.includes('event')) embedColor = '#FF9800';
                                    else if (category.includes('culture') || category.includes('art')) embedColor = '#E91E63';
                                    else embedColor = '#0066CC';
                                } else {
                                    embedColor = '#0066CC';
                                }

                                let newComponents = generateButtons(currentPage, viewMode);
                                await message.edit({
                                    embeds: [generateEmbed(currentPage, viewMode)],
                                    components: newComponents
                                });
                                
                            } else {
                                await componentInteraction.followUp({ 
                                    content: `❌ Article not found in ${selectedLang.toUpperCase()}. Try searching with different terms.`,
                                    ephemeral: true
                                });
                                
                                let originalComponents = generateButtons(currentPage, viewMode);
                                await message.edit({
                                    embeds: [generateEmbed(currentPage, viewMode)],
                                    components: originalComponents
                                });
                            }
                        } catch (error) {
                            console.error('Language switch error:', error);
                            await componentInteraction.followUp({ 
                                content: `❌ Error loading article in ${selectedLang.toUpperCase()}. Please try again.`,
                                ephemeral: true
                            });
                            
                            let originalComponents = generateButtons(currentPage, viewMode);
                            await message.edit({
                                embeds: [generateEmbed(currentPage, viewMode)],
                                components: originalComponents
                            });
                        }
                        return;
                    }

                    // View mode váltó gombok
                    if (componentInteraction.customId === 'wiki_home' ||
                        componentInteraction.customId === 'wiki_images' ||
                        componentInteraction.customId === 'wiki_references' ||
                        componentInteraction.customId === 'wiki_summary') {
                        
                        await componentInteraction.deferUpdate();
                        
                        switch (componentInteraction.customId) {
                            case 'wiki_home':
                                viewMode = 'text';
                                break;
                            case 'wiki_images':
                                viewMode = 'images';
                                imageCurrentPage = 0;
                                break;
                            case 'wiki_references':
                                viewMode = 'references';
                                referencesCurrentPage = 0;
                                break;
                            case 'wiki_summary':
                                viewMode = 'summary';
                                break;
                        }

                        let newComponents = generateButtons(currentPage, viewMode);
                        await message.edit({
                            embeds: [generateEmbed(currentPage, viewMode)],
                            components: newComponents
                        });
                        return;
                    }

                    // Navigation gombok
                    await componentInteraction.deferUpdate();

                    if (viewMode === 'text') {
                        switch (componentInteraction.customId) {
                            case 'wiki_first':
                                currentPage = 0;
                                break;
                            case 'wiki_prev':
                                currentPage = Math.max(0, currentPage - 1);
                                break;
                            case 'wiki_next':
                                currentPage = Math.min(totalPages - 1, currentPage + 1);
                                break;
                            case 'wiki_last':
                                currentPage = totalPages - 1;
                                break;
                        }
                    } else if (viewMode === 'images') {
                        switch (componentInteraction.customId) {
                            case 'wiki_img_first':
                                imageCurrentPage = 0;
                                break;
                            case 'wiki_img_prev':
                                imageCurrentPage = Math.max(0, imageCurrentPage - 1);
                                break;
                            case 'wiki_img_next':
                                imageCurrentPage = Math.min(imageTotalPages - 1, imageCurrentPage + 1);
                                break;
                            case 'wiki_img_last':
                                imageCurrentPage = imageTotalPages - 1;
                                break;
                        }
                    } else if (viewMode === 'references') {
                        switch (componentInteraction.customId) {
                            case 'wiki_ref_first':
                                referencesCurrentPage = 0;
                                break;
                            case 'wiki_ref_prev':
                                referencesCurrentPage = Math.max(0, referencesCurrentPage - 1);
                                break;
                            case 'wiki_ref_next':
                                referencesCurrentPage = Math.min(referencesTotalPages - 1, referencesCurrentPage + 1);
                                break;
                            case 'wiki_ref_last':
                                referencesCurrentPage = referencesTotalPages - 1;
                                break;
                        }
                    }

                    let newComponents = generateButtons(currentPage, viewMode);
                    await message.edit({
                        embeds: [generateEmbed(currentPage, viewMode)],
                        components: newComponents
                    });

                } catch (error) {
                    console.error('Component interaction error:', error);
                    try {
                        if (!componentInteraction.replied && !componentInteraction.deferred) {
                            await componentInteraction.reply({ 
                                content: '❌ An error occurred while processing your request.', 
                                ephemeral: true 
                            });
                        }
                    } catch (e) {
                        console.error('Error reply failed:', e);
                    }
                }
            });

            // Modal Submit collector külön
            let modalCollector = interaction.client.on('interactionCreate', async (modalInteraction) => {
                if (!modalInteraction.isModalSubmit()) return;
                if (modalInteraction.customId !== 'wiki_search_modal') return;
                if (modalInteraction.message?.id !== message.id) return;

                try {
                    let newQuery = modalInteraction.fields.getTextInputValue('wiki_search_input');
                    
                    // Loading állapot jelzés
                    let loadingEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🔄 Searching Wikipedia...')
                        .setDescription(`Searching for **"${newQuery}"**...`)
                        .addFields({
                            name: '⏳ Please wait',
                            value: 'Fetching content from Wikipedia...',
                            inline: false
                        })
                        .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png')
                        .setFooter({ 
                            text: `Wikipedia New Search • ${interaction.user.tag || interaction.user.id}`, 
                            iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                        });

                    await modalInteraction.update({
                        embeds: [loadingEmbed],
                        components: []
                    });

                    // Új keresés végrehajtása
                    try {
                        let newSearchResults = await wikiInstance.search(newQuery);
                        
                        if (newSearchResults.results && newSearchResults.results.length > 0) {
                            // Új oldal betöltése
                            let newPage = await wikiInstance.page(newSearchResults.results[0]);
                            let newSummary = await newPage.summary();
                            let newPageUrl = newPage.url();
                            
                            // Új részletes adatok lekérése
                            let newMainImage = null;
                            let newCategories = [];
                            let newCoordinates = null;
                            let newInfobox = null;
                            let newImages = [];
                            let newReferences = [];
                            let newLanglinks = [];
                            
                            try { newMainImage = await newPage.mainImage(); } catch (e) { console.log('No main image'); }
                            try { newCategories = await newPage.categories(); } catch (e) { console.log('No categories'); }
                            try { newCoordinates = await newPage.coordinates(); } catch (e) { console.log('No coordinates'); }
                            //try { newInfobox = await newPage.infobox(); } catch (e) { console.log('No infobox'); }
                            try { 
                                let allNewImages = await newPage.images(); 
                                // Filter to only Discord-supported image formats
                                const supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                                newImages = allNewImages.filter(imageUrl => {
                                    let lowerUrl = imageUrl.toLowerCase();
                                    return supportedFormats.some(format => lowerUrl.includes(format));
                                });
                            } catch (e) { console.log('No images'); }
                            try { newReferences = await newPage.references(); } catch (e) { console.log('No references'); }
                            try { newLanglinks = await newPage.langlinks(); } catch (e) { console.log('No langlinks'); }

                            // Globális változók frissítése
                            query = newQuery;
                            page = newPage;
                            pageUrl = newPageUrl;
                            mainImage = newMainImage;
                            categories = newCategories;
                            coordinates = newCoordinates;
                            infobox = newInfobox;
                            images = newImages;
                            references = newReferences;
                            langlinks = newLanglinks;
                            searchResults = newSearchResults;
                            
                            // Summary feldolgozása az új tartalomra
                            let newCleanSummary = newSummary
                                .replace(/\n\n+/g, '\n\n')
                                .replace(/\([^)]*\)/g, '')
                                .trim();

                            cleanSummary = newCleanSummary;

                            // Text chunking újra az új tartalomra
                            let newParagraphs = newCleanSummary.split('\n\n');
                            let newChunks = [];
                            let newCurrentChunk = '';
                            
                            for (let paragraph of newParagraphs) {
                                if ((newCurrentChunk + paragraph).length > 1500) {
                                    if (newCurrentChunk) {
                                        newChunks.push(newCurrentChunk.trim());
                                        newCurrentChunk = paragraph;
                                    } else {
                                        let sentences = paragraph.split('. ');
                                        let sentenceChunk = '';
                                        for (let sentence of sentences) {
                                            if ((sentenceChunk + sentence).length > 1500) {
                                                if (sentenceChunk) {
                                                    newChunks.push(sentenceChunk.trim() + '.');
                                                    sentenceChunk = sentence;
                                                } else {
                                                    newChunks.push(sentence.substring(0, 1500) + '...');
                                                }
                                            } else {
                                                sentenceChunk += (sentenceChunk ? '. ' : '') + sentence;
                                            }
                                        }
                                        if (sentenceChunk) newCurrentChunk = sentenceChunk + '.';
                                    }
                                } else {
                                    newCurrentChunk += (newCurrentChunk ? '\n\n' : '') + paragraph;
                                }
                            }
                            if (newCurrentChunk) newChunks.push(newCurrentChunk.trim());
                            
                            chunks = newChunks;
                            totalPages = Math.max(1, chunks.length);
                            imageTotalPages = Math.max(1, images.length);
                            
                            // References chunking újra
                            let newReferencesChunks = [];
                            if (newReferences.length > 0) {
                                let referencesPerPage = 10;
                                for (let i = 0; i < newReferences.length; i += referencesPerPage) {
                                    newReferencesChunks.push(newReferences.slice(i, i + referencesPerPage));
                                }
                            }
                            referencesChunks = newReferencesChunks;
                            referencesTotalPages = Math.max(1, referencesChunks.length);
                            
                            currentPage = 0;
                            imageCurrentPage = 0;
                            referencesCurrentPage = 0;
                            viewMode = 'text';
                            
                            // Embed színe újra a kategóriák alapján
                            if (newCategories.length > 0) {
                                let category = newCategories[0].toLowerCase();
                                if (category.includes('people') || category.includes('person') || category.includes('birth')) embedColor = '#FF6B9D';
                                else if (category.includes('place') || category.includes('location') || category.includes('cities')) embedColor = '#4CAF50';
                                else if (category.includes('science') || category.includes('technology')) embedColor = '#9C27B0';
                                else if (category.includes('history') || category.includes('event')) embedColor = '#FF9800';
                                else if (category.includes('culture') || category.includes('art')) embedColor = '#E91E63';
                                else embedColor = '#0066CC';
                            } else {
                                embedColor = '#0066CC';
                            }

                            let newComponents = generateButtons(currentPage, viewMode);
                            await message.edit({
                                embeds: [generateEmbed(currentPage, viewMode)],
                                components: newComponents
                            });
                            
                        } else {
                            await modalInteraction.followUp({ 
                                content: `❌ No results found for "${newQuery}". Please try different search terms.`,
                                ephemeral: true
                            });
                            
                            let originalComponents = generateButtons(currentPage, viewMode);
                            await message.edit({
                                embeds: [generateEmbed(currentPage, viewMode)],
                                components: originalComponents
                            });
                        }
                    } catch (error) {
                        console.error('New search error:', error);
                        await modalInteraction.followUp({ 
                            content: `❌ Error searching for "${newQuery}". Please try again.`,
                            ephemeral: true
                        });
                        
                        let originalComponents = generateButtons(currentPage, viewMode);
                        await message.edit({
                            embeds: [generateEmbed(currentPage, viewMode)],
                            components: originalComponents
                        });
                    }
                } catch (error) {
                    console.error('Modal interaction error:', error);
                }
            });

            collector.on('end', () => {
                try {
                    let disabledComponents = generateButtons(currentPage, viewMode).map(row => {
                        let newRow = new ActionRowBuilder();
                        row.components.forEach(component => {
                            if (component.data.style === ButtonStyle.Link) {
                                newRow.addComponents(component);
                            } else if (component.data.type === 3) {
                                newRow.addComponents(
                                    StringSelectMenuBuilder.from(component).setDisabled(true)
                                );
                            } else {
                                newRow.addComponents(
                                    ButtonBuilder.from(component).setDisabled(true)
                                );
                            }
                        });
                        return newRow;
                    });

                    message.edit({ 
                        embeds: [generateEmbed(currentPage, viewMode)], 
                        components: disabledComponents 
                    }).catch((error) => {
                        console.error('Error disabling components after timeout:', error);
                    });
                } catch (error) {
                    console.error('Collector end error:', error);
                }
            });

        } catch (error) {
            console.error('Wikipedia search error:', error);
            
            let errorEmbed = new EmbedBuilder()
                .setColor('#FF4444')
                .setTitle('❌ Search Error')
                .setDescription(`An error occurred while searching for **"${query}"** on Wikipedia.`)
                .addFields(
                    {
                        name: '🔧 Error Details',
                        value: `Language: ${language}\nError: ${error.message || 'Unknown error'}`,
                        inline: false
                    },
                    {
                        name: '💡 What to try',
                        value: '• Try searching in English\n• Use different search terms\n• Check your spelling\n• Try again in a few moments',
                        inline: false
                    }
                )
                .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/200px-Wikipedia-logo-v2.svg.png')
                .setFooter({ 
                    text: `Wikipedia Search Error • Requested by ${interaction.user.tag || interaction.user.id}`, 
                    iconURL: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Wikipedia-logo-v2.svg/50px-Wikipedia-logo-v2.svg.png' 
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};