"use strict";

import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import octokit from "@octokit/request";

let config, rawInputs, inputs;
let atfPrompt, arPrompt, confPrompt, menuPrompt, start;

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
        type: "list",
        name: "goBack",
        message: "Finished configuration, go back to the main menu?",
        choices: ["Yes", "No"],
        filter: input => {
            return input == "Yes" ? true : false;
        }
    }
];

/** Checks if the specified repository exists. */
let isValid = async (user, repository) => {
    try{
         const status = await octokit.request("GET /repos/:owner/:repo", {
            owner: user,
            repo: repository
         }).then(r => r.status);

        return await status == 200 ? true : false;
    }catch(e){
        //do nothing.
    }
}

let bold = (text) => {
    return chalk.bold(text);
}

/** Artifacts prompt function */
atfPrompt = async (user, repository) => {
    console.info("Requesting artifacts data..");
        const rawList = await octokit.request("GET /repos/:owner/:repo/actions/artifacts", {
            owner: user,
            repo: repository
        });

        const req = await rawList.data;
        //console.log(req);

        if(await rawList.status == 200){
            var data = "";

            await req.total_count > 0 ? console.info(`Fetched a total of ${req.total_count} ${req.total_count > 1 ? "artifacts" : "artifact"}, showing only ${req.artifacts.length}.`) : console.log("No artifacts found.");
            await req.artifacts.reverse().forEach(a => {
                let name = chalk.bold.whiteBright(a.name);
                let id = chalk.white(`ID: ${a.id}`);
                let size = chalk.white(`${a.size_in_bytes} bytes`);
                let createdDate = chalk.blackBright(new Date(a.created_at).toUTCString());

                data += `${name}\n${id}\n${size}\n${createdDate}\n\n`;
            });

            await console.log(data);
        }
};

/** Artifacts & releases prompt function */
arPrompt = () => {
    inquirer.prompt(menuPrompts[1]).then(input => {
        if(input.ar == "Artifacts") atfPrompt(config.user, config.repository);
        else rlsPrompt();
    });
}

/** Configuration prompt function. */
confPrompt = async () => {
    await inquirer.prompt(confPrompts.slice(0, 2)).then(input => {
        rawInputs = JSON.stringify(input, null, " ");
        inputs = JSON.parse(rawInputs);
    });

    console.info("\nChecking if the repository exists..");

    if(await isValid(inputs.user, inputs.repository)){
        await fs.writeFileSync("./config.json", rawInputs);

        await console.info(chalk.greenBright(`Repository found: ${inputs.user}/${inputs.repository}\n`));
        config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));

        await inquirer.prompt(confPrompts.slice(-1)).then(input => {
            input.goBack ? menuPrompt() : process.exit(0);
        });
    }else{
        console.error(chalk.redBright("Cannot find the specified repository, try again."));
        process.exit(1);
    }
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

    menuPrompt();
};

try{
    config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
    start();
}catch(e){
    console.error(e);
    console.error("config.json doesn't exist, create a new one by doing 'node create.js'.");
};
