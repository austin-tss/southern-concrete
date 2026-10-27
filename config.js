/* Southern Concrete Coatings Field Desk
   TEST_MODE is the single switch for outgoing mail.
   true  = every email is forced to TEST_TO. Code.gs enforces the same flag.
   false = mail goes to the customer address stored on the job.
   Leave this true until you are ready for real customers, and change it in
   Code.gs at the same time. Both copies must match. */
var TEST_MODE = false;
var TEST_TO = 'austin@techsourcedsolutions.com';

/* Field PIN. This static app has no server login. The Owner PIN lives in ROLES
   below. It is not an account password. Change it before the crew uses the desk. */
var ROLES = {
  '1234': 'Owner'
};

/* Paste the Apps Script web app /exec URL after you deploy Code.gs.
   Leave this empty until then. No API keys live here. */
var API_URL = 'https://script.google.com/macros/s/AKfycbz-NoJHojOq7xZz-iBWu78NrhX4J-pv-6q4BVrPVdx8A5h4CqG_vt3hY4ZE4dKq77Oq/exec';

var CO = {
  name: 'Southern Concrete Coatings',
  desk: 'Field Desk',
  legal: 'Southern Concrete Coatings LLC',
  addr: 'Tallahassee, FL',
  phone: '(850) 766-9992',
  email: 'mccardlematt@yahoo.com',
  web: 'www.southernconcretecoatingsllc.com',
  site: 'https://www.southernconcretecoatingsllc.com/'
};
