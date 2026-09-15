// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use base64::{decode, engine::general_purpose, Engine as _};
use chrono::Utc;
use reqwest::Client;
use serde_json::json;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::{env, fs::File, io::Write, process::Command};
use tauri::command;
use tokio::runtime::Runtime;

use tauri::{AppHandle, Manager, image::Image};

use open;

use tauri::State;

use std::{
    io::{prelude::*, BufReader},
    net::{TcpListener, TcpStream},
};

use std::sync::{Arc, Mutex};


struct PkceState {
    code_verifier: Mutex<String>,
    pending_pdf: Mutex<Option<String>>,
    pending_email_address: Mutex<Option<String>>,
    pending_invoice_id: Mutex<Option<String>>,
}

const LOGO: &[u8] = include_bytes!("../assets/logo.png");

const CLIENT_ID: &str = "YOUR-CLIENT_ID";
const TENANT_ID: &str = "YOUR_TENANT_ID";

#[command]
fn print_pdf_base64(base64_pdf: String) -> Result<(), String> {
    // Decode base64 → bytes
    let pdf_bytes = decode(&base64_pdf).map_err(|e| format!("Base64 decode error: {}", e))?;

    // Create temp file
    let mut path = env::temp_dir();
    path.push("tauri_print_temp.pdf");
    let mut file = File::create(&path).map_err(|e| e.to_string())?;
    file.write_all(&pdf_bytes).map_err(|e| e.to_string())?;

    // Print using OS default printer
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args([
                "-Command",
                &format!(
                    "Start-Process -FilePath '{}' -Verb Print",
                    path.to_str().unwrap()
                ),
            ])
            .spawn()
            .map_err(|e| format!("Print command error: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("lp")
            .arg(path.to_str().unwrap())
            .spawn()
            .map_err(|e| format!("Print command error: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("lp")
            .arg(path.to_str().unwrap())
            .spawn()
            .map_err(|e| format!("Print command error: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn try_send_mail(
    state: State<'_, Arc<PkceState>>,
    pdf_base64: String,
    email_address: String,
    invoice_id: String,
) -> Result<(), String> {
    match get_valid_access_token().await {
        Ok(access_token) => {
            println!("Using valid access token.");
            send_email(
                &access_token,
                Some(&pdf_base64),
                Some(&email_address),
                Some(&invoice_id),
            )
            .await
            .map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(_) => {
            println!("No valid token. Starting login flow...");

            // Store PDF path for later
            *state.pending_pdf.lock().unwrap() = Some(pdf_base64);
            *state.pending_email_address.lock().unwrap() = Some(email_address);
            *state.pending_invoice_id.lock().unwrap() = Some(invoice_id);

            start_login(state).map_err(|e| e.to_string())
        }
    }
}

// === TOKEN HANDLING ===
async fn get_valid_access_token() -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let mut app_data_dir = dirs::data_dir().expect("Could not find data directory");
    app_data_dir.push("Rokningar"); // ensure folder exists
    std::fs::create_dir_all(&app_data_dir).ok(); // create folder if missing

    let mut token_path = app_data_dir.clone();
    token_path.push("tokens.json"); // append the file name

    if !token_path.exists() {
        println!("path not found!");
        return Err("No token file".into());
    }

    let token_data = std::fs::read_to_string(token_path)?;
    let mut tokens: serde_json::Value = serde_json::from_str(&token_data)?;
    let expires_at = tokens["expires_at"].as_u64().unwrap_or(0);
    let now = Utc::now().timestamp() as u64;

    // still valid?
    if now + 60 < expires_at {
        return Ok(tokens["access_token"].as_str().unwrap().to_string());
    }

    // refresh
    let refresh_token = tokens["refresh_token"].as_str().ok_or("No refresh token")?;
    let client = Client::new();
    let mut params = HashMap::new();
    params.insert("client_id", CLIENT_ID);
    ///CLIENT_ID
    params.insert("grant_type", "refresh_token");
    params.insert("refresh_token", refresh_token);
    params.insert(
        "scope",
        "https://graph.microsoft.com/mail.send offline_access",
    );

    let res = client
        .post(format!("https://login.microsoftonline.com/{}/oauth2/v2.0/token", TENANT_ID)) // TENANT_ID
        .form(&params)
        .send()
        .await?;

    let text = res.text().await?;
    let new_json: serde_json::Value = serde_json::from_str(&text)?;

    let new_access_token = new_json["access_token"]
        .as_str()
        .ok_or("Missing access_token")?
        .to_string();

    let new_refresh_token = new_json["refresh_token"]
        .as_str()
        .unwrap_or(refresh_token)
        .to_string();
    let new_expires_in = new_json["expires_in"].as_u64().unwrap_or(3600);

    println!("New access token: {}", &new_access_token);

    // Save new tokens
    save_tokens(&new_access_token, &new_refresh_token, new_expires_in)?;

    Ok(new_access_token)
}

fn run_server_listener(state: Arc<PkceState>) {
    let listener = TcpListener::bind("127.0.0.1:8080").unwrap();

    for stream in listener.incoming() {
        let stream = stream.unwrap();
        let state_clone = state.clone();
        handle_connection(stream, state_clone);
    }
}
#[tauri::command]
fn start_login(state: State<'_, Arc<PkceState>>) -> Result<(), String> {
    let (code_verifier, code_challenge) = generate_pkce_pair();

    // Store verifier for later use
    *state.code_verifier.lock().unwrap() = code_verifier.clone();

    let authorize_url = format!(
        "https://login.microsoftonline.com/{}/oauth2/v2.0/authorize\
        ?client_id={}\
        &response_type=code\
        &redirect_uri=http%3A%2F%2Flocalhost%3A8080\
        &response_mode=query\
        &scope=https%3A%2F%2Fgraph.microsoft.com%2Fmail.send%20offline_access\
        &code_challenge={code_challenge}\
        &code_challenge_method=S256\
        &state=12345", TENANT_ID, CLIENT_ID
    );
    // CLIENT_ID
    // TENANT_ID

    open::that(authorize_url).map_err(|e| e.to_string())?;
    Ok(())
}

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};

fn generate_pkce_pair() -> (String, String) {
    // Generate a random 32-byte verifier
    let mut verifier_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut verifier_bytes);
    let code_verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);

    // Derive the challenge
    let code_challenge_bytes = Sha256::digest(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(code_challenge_bytes);

    (code_verifier, code_challenge)
}

fn handle_connection(mut stream: TcpStream, state: Arc<PkceState>) {
    let buf_reader = BufReader::new(&stream);
    let http_request: Vec<_> = buf_reader
        .lines()
        .map(|result| result.unwrap())
        .take_while(|line| !line.is_empty())
        .collect();

    let first_line = &http_request[0];
    if let Some(start) = first_line.find("/?") {
        if let Some(end) = first_line.find(" HTTP/1.1") {
            let slice = &first_line[start + 2..end]; // removes "GET /?" and " HTTP/1.1"

            let mut code = "";
            let mut session_state = "";

            for param in slice.split('&') {
                let mut kv = param.splitn(2, '=');
                let key = kv.next().unwrap_or("");
                let value = kv.next().unwrap_or("");

                match key {
                    "code" => code = value,
                    "session_state" => session_state = value,
                    _ => {}
                }
            }

            println!(
                "{}",
                format!("code: {}, session_state: {}", code, session_state)
            );

            let code_clone = code.to_string();
            let state_clone = state.clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().unwrap();
                rt.block_on(async move {
                    if let Err(e) = exchange_code_for_token(&code_clone, &state_clone).await {
                        eprintln!("Failed to exchange code: {e}");
                    }
                });
            });
        }
    }

    // Send a simple HTTP response so browser doesn’t hang
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nOAuth code received. You can close this window.";
    stream.write_all(response.as_bytes()).unwrap();
}

async fn exchange_code_for_token(
    code: &str,
    state: &Arc<PkceState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let client = Client::new();
    let code_verifier = state.code_verifier.lock().unwrap().clone();

    let mut params = HashMap::new();
    params.insert("client_id", CLIENT_ID);
    params.insert(
        "scope",
        "https://graph.microsoft.com/mail.send offline_access",
    );
    params.insert("code", code);
    params.insert("redirect_uri", "http://localhost:8080");
    params.insert("grant_type", "authorization_code");
    params.insert("code_verifier", &code_verifier);

    let res = client
        .post(format!("https://login.microsoftonline.com/{}/oauth2/v2.0/token", TENANT_ID))
        .form(&params)
        .send()
        .await?;

    let text = res.text().await?;
    let json: Value = serde_json::from_str(&text)?;

    // Extract access and refresh tokens
    let access_token = json["access_token"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let refresh_token = json["refresh_token"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    let expires_in = json["expires_in"].as_u64().unwrap_or(3600);
    println!("Response: {expires_in}");

    save_tokens(&access_token, &refresh_token, expires_in)?;

    if let Some(pdf_base64) = state.pending_pdf.lock().unwrap().take() {
        if let Some(email_address) = state.pending_email_address.lock().unwrap().take() {
            if let Some(invoice_id) = state.pending_invoice_id.lock().unwrap().take() {
                send_email(
                    &access_token,
                    Some(&pdf_base64),
                    Some(&email_address),
                    Some(&invoice_id),
                )
                .await?;
            }
        }
    }

    Ok(())
}

fn save_tokens(access_token: &str, refresh_token: &str, expires_in: u64) -> std::io::Result<()> {
    let mut app_data_dir = dirs::data_dir().expect("Could not find data directory");
    app_data_dir.push("Rokningar/tokens.json");

    let expires_at = Utc::now().timestamp() as u64 + expires_in; // absolute timestamp

    let tokens = serde_json::json!({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": expires_at
    });

    fs::write(app_data_dir, serde_json::to_string_pretty(&tokens).unwrap())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pkce_state = Arc::new(PkceState {
        code_verifier: Mutex::new(String::new()),
        pending_pdf: Mutex::new(None),
        pending_email_address: Mutex::new(None),
        pending_invoice_id: Mutex::new(None),
    });

    let listener_state = pkce_state.clone();
    std::thread::spawn(move || {
        run_server_listener(listener_state);
    });
    create_app_folder();

    tauri::Builder::default()
        .manage(pkce_state.clone())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            try_send_mail,
            print_pdf_base64,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn create_app_folder() {
    // Get AppData folder on Windows, or equivalent on other OS
    let mut app_data_dir = dirs::data_dir().expect("Could not find data directory");

    // Append "Rokningar" directly
    app_data_dir.push("Rokningar");

    // Create the folder if it doesn't exist
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir).expect("Failed to create Rokningar folder");
    }
}

pub async fn send_email(
    access_token: &str,
    pdf_base64: Option<&str>,
    email_address: Option<&str>,
    invoice_id: Option<&str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let pdf_base64 = pdf_base64.ok_or("No PDF data provided.")?;
    let email_address = email_address.ok_or("No email address provided.")?;
    let invoice_id = invoice_id.ok_or("No invoice ID provided.")?;

    let base64_logo = general_purpose::STANDARD.encode(LOGO);

    let client = Client::new();

    let mail = json!({
        "message": {
            "subject": format!("Business Name - Faktura {}", invoice_id),
            "body": {
                "contentType": "HTML",
                "content": format!(
                    r#"
                    <p>Viðheft er faktura {invoice_id}.</p>
                    <p style="margin: 0 0 45px 0">Vinarliga heilsan</p>
                    <img src="cid:business-logo" width="200" alt="Business Name" />
                    <p style="margin:0">
                        Address | 999 City<br/>
                        Telephone number | example@example.com
                    </p>
                    "#)
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": email_address
                    }
                }
            ],
            "attachments": [
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": format!("Faktura {}.pdf", invoice_id),
                    "contentBytes": pdf_base64,
                    "contentType": "application/pdf"
                },
                {
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": "logo.png",
                    "contentId": "business-logo",
                    "isInline": true,
                    "contentBytes": base64_logo
                }
            ]
        },
        "saveToSentItems": "true"
    });

    let res = client
        .post("https://graph.microsoft.com/v1.0/me/sendMail")
        .bearer_auth(access_token)
        .json(&mail)
        .send()
        .await?;

    if res.status().is_success() {
        println!("✅ Email sent successfully!");
    } else {
        println!("Failed to send email: {:?}", res.text().await?);
    }

    Ok(())
}
