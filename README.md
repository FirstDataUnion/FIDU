## FIDU

Take control of your digital identity and break free from Big Tech. The FIDU app empowers users to collect and securely store their personal data, define precise preferences for its usage, and serve it to applications and agents strictly on their terms.

## More about FIDU

https://firstdataunion.org/intro/site_1.html 

## What it is

This project aims to demonstrate a taste of FIDU’s dream, where all use of a user’s data can be collected, controlled, and managed by the user themselves via this application. This is the first step towards reclaiming our data from big tech. 

## What it does

The application will collect the user’s data via an extensible ecosystem of data collection tools in the “Data Collection Layer”, starting with our initial web browser plugin. These tools transmit collected data to the core FIDU App, which then orchestrates its storage using a set of configurable and extensible storage options. Furthermore, the main application provides a user interface to define and manage your data sharing and usage preferences. Finally, authorised "Application Layer" programs can access and utilise your data  according to these defined preferences. 

TODO: Diagram


## The Goal

Our ultimate goal is to empower users to collect and control a large portion of their digital footprint within this data union. Eventually, the richness and comprehensiveness of this user-managed data will incentivise tech companies to directly request data from the union, thereby granting users unparalleled control over what information is shared and for what purpose.

## Installation

Coming Soon: instructions on a local installation. 

## Development Setup

Once pulling the repo, run the following script before you start work:

`/scripts/setup_dev.sh`

this will install all requirements, including dev only tools (linters, formatters etc.), 
create a virtual env, activate the virtual env, and set up the precommit hook to run all linters/testers on every commit. 

Linters/tests can be run manually via the command './scripts/lint.sh'

## Usage

The core App can be started up with:
`uvicorn src.fidu_core.main:app --port 4000 --reload`

This will run it with an auto-reload mechanism, where any changes made will be automatically detected and cause a hot-reload to allow for quick development cycles. 

The FIDU Core backend can then be accessed by going to 

`http://127.0.0.1:4000`

API docs can be viewed at

`http://127.0.0.1:4000/docs`

Once this is running, the ACM-Capture chrome plugin and ACM-Lab front end can be used along with it. These have separate README files in their respective directories. 

All these apps share the same identity system, and creating an account in one allows you to log into all 3. 


## What’s (currently) in the box

Around the core orchestration application, there are a small suite of collection/storage/processing options to demonstrate development in these layers. The idea is that these will be extended into larger suites of options/application with time, resulting in a diverse set of options.

## Integrations/APIs

Coming Soon

**Description/links to API docs (hoping to use proto + swagger to maybe auto-generate these). This is an important section. 

## Contributing

Contributions are very welcome! Feel free to fork the repo and use a feature branch. 

TODO: describe what we want from contributions, integrations + main code changes?

## Licence

TODO
