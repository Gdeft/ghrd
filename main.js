"use strict";

const chalk = require("chalk");
const download = require("download");
const fs = require("fs");
const inquirer = require("inquirer");
const {Octokit} = require("@octokit/core");

let octokit, config, rawInputs, inputs;
let atfPrompt, rlsPrompt,  arPrompt, confPrompt, menuPrompt, start;

const title = "          __             __\n   ____ _/ /_  _________/ /\n  / __ `/ __ \\/ ___/ __  / \n / /_/ / / / / /  / /_/ /  \n \\__, /_/ /_/_/   \\__,_/   \n/____/                     \n                           ";
const menuPrompts = [
    {
        type: "list",
        name: "menu",
        message: "Main Menu",
        choices: ["Artifacts & Releases", "Set Configuration", "Exit"]
    },
    {
        type: "list",
        name: "ar",
        message: "Which one would you like to download?",
        choices: ["Artifacts", "Releases"]
    }
];

const confPrompts = [
    {
        type: "input",
        name: "user",
        message: "Repository owner name:",
        default: () => {
            return config.user != undefined ? config.user : "";
        }
    },
    {
        type: "input",
        name: "repository",
        message: "Repository name:",
        default: () => {
            return config.repository != undefined ? config.repository : "";
        }
    },
    {
        type: "input",
        name: "authToken",
        message: "Access token:",
        default: () => {
            return config.authToken != undefined ? config.authToken : "";
        }
    },
    {
        type: "input",
        name: "directory",
        message: "Set destination:",
        default: () => {
            return config.directory != undefined ? config.directory : "";
        }
    },
    {
        type: "list",
        name: "goBack",
        message: "Finished configuration, go back to the main menu?",
        choices: ["Yes", "No"],
        filter: input => {
            return input == "Yes" ? true : false;
        }
    }
];

let isValidDir = (directory) => {
    try{
        if(fs.existsSync(directory)){
            console.info(chalk.greenBright(`Directory found: \'${directory}\'`));
            return true;
        }else{
            console.error(chalk.redBright("Cannot find the specified directory, try again."));
            return false;
        };
    }catch(e){
        //do nothing.
    };
};

/** Checks if the specified repository exists. */
let isValidRepo = async (user, repository) => {
    try{
        const status = await octokit.request("GET /repos/:owner/:repo", {
            owner: user,
            repo: repository
        }).then(r => r.status);

        if(status == 200){
            console.info(chalk.greenBright(`Repository found: \'${user}/${repository}\'`));
            return true;
        }else{
            console.error(chalk.redBright("Cannot find the specified repository, try again."));
            return false;
        }
    }catch(e){
        //do nothing.
    };
};

let bold = text => {
    return chalk.bold(text);
};

/** Download artifact function. */
let downloadAtf = async (user, repository, artifact) => {
    try{
        console.info("Getting artifact download URL..");
        
        const reqAtf = await octokit.request("GET /repos/:owner/:repo/actions/artifacts/:artifact_id/:archive_format", {
            owner: user,
            repo: repository,
            artifact_id: artifact.id,
            archive_format: "zip"
        });

        if(await reqAtf.status == 200){
            await console.info(`Downloading ${artifact.name}.zip..`);
            await download(reqAtf.url, config.directory);
            
            await console.info(`Finished downloading ${artifact.name}, file saved at \'${config.directory}\'`);
        }else{
            console.error(chalk.redBright("Failed to get download URL."));
        };
    }catch(e){
        console.error(e);
    };
};

/** Download release function. */
let downloadRls = async (release) => {
    try{
        console.info(`Downloading ${release.assets[0].name}..`);
        await download(release.zipball_url, config.directory);
        
        await console.info(`Finished downloading ${release.assets[0].name}, file saved at \'${config.directory}\'`);
    }catch(e){
        console.error(e);
    };
};

/** Artifacts prompt function. */
atfPrompt = async (user, repository) => {
    console.info("Requesting artifacts data..");
    
    try{
        const rawList = await octokit.request("GET /repos/:owner/:repo/actions/artifacts", {
            owner: user,
            repo: repository
        });

        const req = await rawList.data;
        //console.log(req);

        if(await rawList.status == 200){
            var data = [];

            await req.total_count > 0 ? console.info(`Fetched a total of ${req.total_count} ${req.total_count > 1 ? "artifacts" : "artifact"}, showing only ${req.artifacts.length}.`) : console.log("No artifacts found.");
            await req.artifacts.reverse().forEach(a => {
                let aName = chalk.bold.whiteBright(a.name);
                let aId = chalk.white(`ID: ${a.id}`);
                let aSize = chalk.white(`Size: ${a.size_in_bytes} bytes`);
                let aCreatedDate = chalk.blackBright(new Date(a.created_at).toUTCString());

                data.push(`${aName} ${aId} ${aSize}\n${aCreatedDate} ${req.artifacts.indexOf(a) == req.artifacts.length - 1 ? "(Latest)" : ""}\n`);
            });

            let aList = {
                type: "list",
                name: "artifact",
                message: "Choose which artifact to download.\n",
                choices: data.reverse(),
                filter: input => {
                    return req.artifacts[data.reverse().indexOf(input)];
                }
            };

            await inquirer.prompt(aList).then(input => {
                downloadAtf(user, repository, input.artifact);
            });
        }else{
            console.error(chalk.redBright("Failed to request artifacts data."));
        };
    }catch(e){
        console.error(e);
    };
};

/** Releases prompt function. */
rlsPrompt = async (user, repository) => {
    console.info("Requesting releases data..");
    
    try{
        const rawList = await octokit.request("GET /repos/:owner/:repo/releases", {
            owner: user,
            repo: repository
        });
        
        const req = rawList.data;
        
        if(rawList.status == 200){
            var data = [];
            
            await req.length > 0 ? console.info(`Fetched a total of ${req.length} ${req.length > 1 ? "releases" : "release"}.`) : console.log("No releases found.");
            await req.forEach(r => {
                let rName = chalk.bold.whiteBright(`${r.name} | ${r.tag_name}`);
                let rId = chalk.white(`ID: ${r.id} | ${r.assets[0].id}`);
                let rSize = chalk.white(`Size: ${r.assets[0].size} bytes`);
                let rDownloads = chalk.white(`${r.assets[0].download_count} downloads`);
                let rCreatedDate = chalk.blackBright(new Date(r.created_at).toUTCString());
                
                data.push(` \n${rName}\n${rId} ${rSize} | ${rDownloads}\n${rCreatedDate} ${req.indexOf(r) == 0 ? "(Latest)" : ""}\n`);
            });

            let rList = {
                type: "list",
                name: "release",
                message: "Choose which release to download.\n",
                choices: data.reverse(),
                filter: input => {
                    return req[data.reverse().indexOf(input)];
                }
            };
            
            await inquirer.prompt(rList).then(input => {
                downloadRls(input.release);
            });
        }else{
            console.error(chalk.redBright("Failed to request releases data."));
        };
    }catch(e){
        console.error(e);
    };
};

/** Artifacts & releases prompt function. */
arPrompt = () => {
    inquirer.prompt(menuPrompts[1]).then(input => {
        if(input.ar == "Artifacts") atfPrompt(config.user, config.repository);
        else rlsPrompt(config.user, config.repository);
    });
}

/** Configuration prompt function. */
confPrompt = async () => {
    await inquirer.prompt(confPrompts.slice(0, 4)).then(input => {
        octokit = new Octokit({auth: input.authToken});
        rawInputs = JSON.stringify(input, null, " ");
        inputs = JSON.parse(rawInputs);
    });

    console.info("\nChecking if the repository and directory exists..");

    if(await isValidRepo(inputs.user, inputs.repository) && isValidDir(inputs.directory)){
        await inquirer.prompt(confPrompts.slice(-1)).then(input => {
            input.goBack ? menuPrompt() : process.exit(0);
        });

        await fs.writeFileSync("./config.json", rawInputs);
        config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
    }else{
        process.exit(1);
    };
};

/** Main menu prompt function. */
menuPrompt = async () => {
    inquirer.prompt(menuPrompts[0]).then(input => {
        //console.log(input);
        if(input.menu == "Artifacts & Releases") arPrompt();
        else if(input.menu == "Set Configuration") confPrompt();
        else process.exit(0);
    });
};

/** Start package function. */
start = async () => {
    console.log(title);
    console.log(`${bold("ghrd")} - ${bold("g")}it${bold("h")}ub ${bold("r")}epository ${bold("d")}ownloader`);
    console.log(`\nA pointless GitHub repository artifacts/releases downloader written\nusing Node.js.\n`);

    try{
        octokit = new Octokit({auth: config.authToken});
    }catch(e){
        console.error(e);
    };
    
    menuPrompt();
};

try{
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
    start();
}catch(e){
    console.error(e);
    console.error("config.json doesn't exist, create a new one by doing 'node create.js'.");
};
