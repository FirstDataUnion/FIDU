# Quick Start

If you're here, you probably want to get stuck into our tools! 

Go to [https://chatlab.firstdataunion.org/fidu-chat-lab/] create an account if you don't have one - connnect up your own server storage or G-drive 

Reach out for help or log any issues right here on Github [
](https://github.com/FirstDataUnion/FIDU/issues)

Keep reading for more about the project and what it all does...!

# FIDU

Take control of your digital identity and break free from Big Tech. The FIDU chat lab empowers users to collect and securely store their AI interactions, define precise preferences for its usage, and serve it to applications and agents strictly on their terms.

## More about FIDU

https://firstdataunion.org

## The Project

This project aims to demonstrate a taste of FIDU's vision. This is an extremely early version, and we're working hard to add new features and apps all the time.

We are offering this early alpha to encourage those interested in our journey to start interacting with our tools, hopefully finding some useful functionality for themselves, as well as helping to shape its future.

Due to the early stage of this project, there are many caveats to the guarantees we provide so far. Be sure to understand these before using any of our tools.

## Current Functionality

### FIDU Vault

A locally run server that must be running to use other apps. It manages the storage and retrieval of user data and currently offers local storage only.

There is a basic front end that allows users to view their raw stored data and manage profiles for their account.

**IMPORTANT:**

- **Data Compatibility:** We will do our best to maintain stored data and compatibility in future versions, but due to the very early nature of this project, we cannot guarantee this yet. The current project is offered as an experimental offering and should not be relied on for permanence.
- **Data Security:** Please note that as of writing, data encryption is not in place for the stored local data. Be aware of this, and you should treat it, for now, like an unencrypted file on your local machine. If someone gains access to your local machine, they will be able to see what is stored in the FIDU Core. This is an experimental alpha, and we cannot yet guarantee the security of data stored. However, your data is never stored online, and is always encrypted via HTTPS when in transit. 


### Applications

We have released FIDU Vault and two apps to work alongside it. These are examples of what to expect from the application ecosystem:

#### FIDU Chat Lab

A web app allowing a range of features for interacting with LLM chatbots. Allows users to talk with a range of major LLM provider models via NLP Agentic Workbench (an ever-growing list) from a single frontend, providing:
- High visibility and control over the prompts and system prompts used with the models
- A customizable library of system prompts to explore and tweak to your preference
- Ability to create and manage "Contexts" based on previous conversations, so models can refer back to information from this context to help you better. Use these between any models in any way you want. 
- Options to use our paid service to interact with the major model providers without passing them any of your own information; you remain anonymous in their system. 
- Alternatively, use your own LLM provider API keys. No need for a paid FIDU subscription to use the Chat Lab.

We have plenty more features in the works for the Chat Lab, so keep an eye out. 

## Contributing

We do not have a contribution process in place just yet. However, we're working on it, and would love to hear any thoughts you have in the meantime!

## License

[MIT License](LICENSE)
