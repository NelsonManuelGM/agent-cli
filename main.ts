import { stdin as input, stdout as output, exit } from "process"
import fs from "fs";
import { GoogleGenAI, type Content, type ContentListUnion, type GenerateContentConfig, type GenerateContentParameters, type Part, type PartUnion } from "@google/genai";

const MODEL_NAME = process.env.GEMINI_MODEL_NAME || "gemini-3-flash-preview";
//const MODEL_NAME = "gemini-3.8-flash"
//const MODEL_NAME = "gemini-3.7-flash"
//const MODEL_NAME = "gemini-3.1-flash"

console.log("GEMINI_API_KEY: ", process.env.GEMINI_API_KEY);
const genai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || ""
});

let contents: Array<Content> = [
    {
        role: "user",
        parts: [{
            text: `You are a job agent. You are given a job posting url
         and you need to determine if the job is a good fit for the 
         user given it's profile in json format. 
         You need to return a score 1 to 10, the higher the score, the better the fit.
         Also provide a short explanation of the score and the reasons why you gave the score you did.`
        }]
    }
];

async function requestToModel(contents: ContentListUnion) {
    const model = await genai.models.generateContent({
        model: MODEL_NAME,
        config: {
            temperature: 0.9,
            topK: 20,
            topP: 0.95,
        } as GenerateContentConfig,
        contents: contents
    } as GenerateContentParameters)
    return model.text?.trim() ?? "";
}

async function getJobPosting(url: string) {

    // load profile.json
    const profileJson = fs.readFileSync('profile.json', 'utf8');
    const profile = JSON.parse(profileJson);

    contents.push({
        role: "user",
        parts: [{
            text: url
        }]
    }, {
        role: "user",
        parts: [{
            text: JSON.stringify(profile)
        }]
    })
    const score = await requestToModel(contents);
    return score;
}


async function main() {

    output.write("Paste the url to the job to start the conversation: ");
    let isRunning = false;
    input.on('readable', async () => {
        if (isRunning) {
            return;
        }
        isRunning = true;
        while (true) {
            let _input = input.read()?.toString().trim();
            
            if (_input === null || _input === undefined) {
                console.log("Input is null or undefined, value: %o", _input);
                isRunning = false;
                return;
            }

            if (_input === "quit") {
                isRunning = false;
                input.destroy();
                exit(0);
            }

            if (_input && _input.startsWith("http")) {
                const score = await getJobPosting(_input);
                contents.push({
                    role: "user",
                    parts: [{
                        text: _input
                    }]
                })
                contents.push({
                    role: "model",
                    parts: [{
                        text: score
                    }]
                });
                output.write(score);
                output.write("\n");
                isRunning = false;
            } else {
                contents.push({
                    role: "user",
                    parts: [{
                        text: _input
                    }]
                })
                const response = await requestToModel(contents);
                contents.push({
                    role: "model",
                    parts: [{
                        text: response
                    }]
                })
                output.write(response);
                output.write("\n");
                isRunning = false;
            }
        }
    });
    input.on('end', () => {
        output.write("Bye!\n");
        isRunning = false;
        exit(0);
    })
}
main();