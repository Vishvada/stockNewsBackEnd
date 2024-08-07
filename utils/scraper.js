import axios from 'axios';
import cheerio from 'cheerio';

export default async function news(companyName, maxPages = 100) {
  let currentPage = 1;
  const allHeadlines = [];
  const leastDate = new Date();
  const days=2;
  leastDate.setDate(leastDate.getDate()-days);

  while (currentPage <= maxPages) {
    try {
      const url = currentPage === 1 
        ? 'https://www.livemint.com/companies'
        : `https://www.livemint.com/companies/page-${currentPage}`;

      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      const headlines = $('.headlineSec');

      if (headlines.length === 0) {
        console.log(`No headlines found on page ${currentPage}. Stopping.`);
        break;
      }

      let allOldNews = true;

      headlines.each((index, element) => {
        const anchorTag = $(element).find('a');
        const headlineText = $(element).find('.headline').text().trim();
        const headlineLink = anchorTag.attr('href');
        const dateSpan = $(element).find('span[data-updatedtime]');
        const dateStr = dateSpan.attr('data-updatedtime');
        const date = new Date(dateStr);
        if(date >= leastDate)
            allOldNews = false;
        if ( headlineText.toLowerCase().includes(companyName.toLowerCase())) {
          allHeadlines.push({
            text: headlineText,
            link: `https://www.livemint.com`+headlineLink,
            date: date.toISOString().split('T')[0]
          });
        }
      });
      
      if (allOldNews && currentPage > 1) {
        console.log(`All news on page ${currentPage} is older than ${days} days. Stopping.`);
        break;
      }

      currentPage++;

    } catch (error) {
      console.error(`Error on page ${currentPage}:`, error.message);
      break;
    }
  }

  console.log(`\nHeadlines related to ${companyName} from the last 2 days:`);
  allHeadlines.forEach((headline, index) => {
    console.log(`${index + 1}. ${headline.text}`);
    console.log(`   Date: ${headline.date}`);
    console.log(`   Link: ${headline.link}`);
  });

  console.log(`Found a total of ${allHeadlines.length} recent headlines related to ${companyName}`);
  return allHeadlines
}