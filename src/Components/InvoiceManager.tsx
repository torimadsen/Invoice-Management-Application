import { useState, useEffect } from "react";
import "../invoice-manager.css";
import generatePDF from "../utils/generatePDF.ts";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import pdfWorker from "../utils/pdf.worker.min.js?url";
import { useNavigate } from "react-router-dom";
import { printPdf } from "../utils/printPDF.ts";
import { decryptBackup } from "../utils/backup.tsx";
import {
  Printer,
  Download,
  CartCheck,
  PencilSquare,
  CartX,
  Search,
  Trash3,
} from "react-bootstrap-icons";
import {
  writeTextFile,
  readTextFile,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { Invoices } from "../types/invoice.ts";

function InvoiceManager() {
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState("unpaid");
  const [data, setData] = useState<Invoices>({
    rokningar: {},
  });
  const [pdf, setPdf] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(-1);
  const [selectedBase64, setSelectedBase64] = useState("");
  const [markAsUnpaidConfirmation, setMarkAsUnpaidConfirmation] = useState(0);
  const [searchInvoice, setSearchInvoice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState("");

  useEffect(() => {
    const readData = async () => {
      const dataString = await readTextFile("data.json", {
        baseDir: BaseDirectory.AppData,
      });
      const DATA = JSON.parse(dataString);
      setData(DATA);
    };
    readData();
  }, []);

  useEffect(() => {
    setSelectedInvoice(-1);
  }, [sortBy]);

  const base64toBlob = (data: string) => {
    // Cut the prefix `data:application/pdf;base64` from the raw base 64
    const bytes = atob(data);
    let length = bytes.length;
    let out = new Uint8Array(length);

    while (length--) {
      out[length] = bytes.charCodeAt(length);
    }

    return new Blob([out], { type: "application/pdf" });
  };

  const viewPdf = (line: string, index: number) => {
    if (selectedInvoice === index) {
      return;
    }
    setSelectedInvoice(index);
    setConfirmDelete(false);
    setConfirmDeleteInput("");
    console.log(line);
    const base64 = generatePDF(
      data.rokningar[line].list,
      data.rokningar[line].customer,
      data.rokningar[line].total,
      Number(line),
      data.rokningar[line].createdDate,
      data.rokningar[line].dueDate,
      false,
    );
    setSelectedBase64(base64);
    const blob = base64toBlob(base64);
    const url = URL.createObjectURL(blob);
    setPdf(url);
  };

  const printInvoice = async () => {
    await printPdf(selectedBase64);
  };

  const saveInvoicePdf = (line: string) => {
    generatePDF(
      data.rokningar[line].list,
      data.rokningar[line].customer,
      data.rokningar[line].total,
      Number(line),
      data.rokningar[line].createdDate,
      data.rokningar[line].dueDate,
      true, // save = true - means it will be saved
    );
  };

  const markAsPaid = async (line: string, paidStatus: string) => {
    try {
      //set status as paid
      console.log("paid");
      const dataString = await readTextFile("data.json", {
        baseDir: BaseDirectory.AppData,
      });
      const DATA = JSON.parse(dataString);
      DATA.rokningar[line].status = paidStatus;
      await writeTextFile("data.json", JSON.stringify(DATA, null, 2), {
        baseDir: BaseDirectory.AppData,
      });
      setData(DATA); // update react
    } catch (e) {
      console.error("Failed to save invoice", e);
    }
  };

  const markAsUnpaid = (line: string) => {
    // confirm
    if (markAsUnpaidConfirmation === 1) {
      markAsPaid(line, "unpaid");
      setMarkAsUnpaidConfirmation(0);
    } else {
      setMarkAsUnpaidConfirmation(markAsUnpaidConfirmation + 1);
    }
  };

  const searchInvoices = (line: string) => {
    if (
      String(data.rokningar[line].id) !== "" &&
      String(data.rokningar[line].id).includes(searchInvoice)
    ) {
      return true;
    }
    if (
      data.rokningar[line].createdDate !== "" &&
      data.rokningar[line].createdDate.includes(searchInvoice)
    ) {
      return true;
    }

    if (
      data.rokningar[line].customer.fyritøka !== "" &&
      data.rokningar[line].customer.fyritøka
        .toLowerCase()
        .includes(searchInvoice.toLowerCase())
    ) {
      return true;
    }
    if (
      data.rokningar[line].customer.navn !== "" &&
      data.rokningar[line].customer.navn
        .toLowerCase()
        .includes(searchInvoice.toLowerCase())
    ) {
      return true;
    }
    if (
      data.rokningar[line].customer.addressa !== "" &&
      data.rokningar[line].customer.addressa
        .toLowerCase()
        .includes(searchInvoice.toLowerCase())
    ) {
      return true;
    }
    if (
      data.rokningar[line].customer.postnummar !== "" &&
      data.rokningar[line].customer.postnummar
        .toLowerCase()
        .includes(searchInvoice.toLowerCase())
    ) {
      return true;
    }
    if (
      data.rokningar[line].customer.bygd !== "" &&
      data.rokningar[line].customer.bygd
        .toLowerCase()
        .includes(searchInvoice.toLowerCase())
    ) {
      return true;
    }
    if (
      data.rokningar[line].customer.teldupostur !== "" &&
      data.rokningar[line].customer.teldupostur
        .toLowerCase()
        .includes(searchInvoice.toLowerCase())
    ) {
      return true;
    }
    return false;
  };

  const deleteInvoice = async (line: string) => {
    console.log(selectedInvoice);
    console.log(confirmDeleteInput);
    console.log(line);

    if (confirmDeleteInput !== line) {
      return;
    }

    try {
      //set status as paid
      console.log("delete");
      const dataString = await readTextFile("data.json", {
        baseDir: BaseDirectory.AppData,
      });
      const DATA = JSON.parse(dataString);
      DATA.rokningar[line].status = "DELETED";
      await writeTextFile("data.json", JSON.stringify(DATA, null, 2), {
        baseDir: BaseDirectory.AppData,
      });
      setData(DATA); // update react
      setConfirmDelete(false);
      setConfirmDeleteInput("");
    } catch (e) {
      console.error("Failed to save invoice", e);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    line: string,
  ) => {
    if (e.key == "Enter") {
      e.preventDefault();
      deleteInvoice(line);
    }
  };

  const retrieveBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      console.log(e.target.files[0]);
      const backupFile = await decryptBackup(e.target.files[0]);
      if (!backupFile) {
        return;
      }
      console.log(backupFile);
      await writeTextFile(
        `decrypted-${e.target.files[0].name}.json`,
        backupFile,
        {
          baseDir: BaseDirectory.Download,
        },
      );
    }
  };

  const listItems = Object.keys(data.rokningar)
    .filter(
      (line: string) =>
        data.rokningar[line].status === sortBy && searchInvoices(line),
    )
    .map((line: string, index) => (
      <div
        className={
          selectedInvoice === index
            ? "invoice bg-body-secondary"
            : "invoice bg-light"
        }
        onClick={() => viewPdf(line, index)}
      >
        <span>
          <b>{line}</b>{" "}
        </span>

        {data.rokningar[line].customer.fyritøka !== "" ? (
          <span>{data.rokningar[line].customer.fyritøka}</span>
        ) : (
          <span>{data.rokningar[line].customer.navn}</span>
        )}

        <span> {data.rokningar[line].customer.teldupostur}</span>

        {selectedInvoice === index && sortBy === "saved" ? (
          <div>
            <button
              className="btn btn-primary me-1 mt-2"
              onClick={() => navigate(`/stovna/${line}`)}
            >
              <PencilSquare />
              <span> Broyt</span>
            </button>
            <button
              className="btn btn-primary me-1 mt-2"
              onClick={() => printInvoice()}
            >
              <Printer />
              <span> Printa</span>
            </button>
            <button
              className="btn btn-primary mt-2 me-1"
              onClick={() => saveInvoicePdf(line)}
            >
              <Download />
              <span> Tak niður</span>
            </button>
            {confirmDelete ? (
              <div>
                <span>
                  Skriva fakturanummarið inn og trýst síðan á "Enter" fyri at
                  sletta fakturan
                </span>
                <input
                  onKeyDown={(e) => handleKeyDown(e, line)}
                  onChange={(e) => setConfirmDeleteInput(e.target.value)}
                  className="form-control w-25 remove-inner-spin-button"
                  type="number"
                ></input>
              </div>
            ) : (
              <button
                className="btn btn-danger mt-2"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash3 />
                <span> Sletta</span>
              </button>
            )}
          </div>
        ) : (
          <div></div>
        )}
        {selectedInvoice === index && sortBy === "unpaid" ? (
          <div>
            <button
              className="btn btn-success  me-1 mt-2"
              onClick={() => markAsPaid(line, "paid")}
            >
              <CartCheck />
              <span> Goldið</span>
            </button>
            <button
              className="btn btn-primary  me-1 mt-2"
              onClick={() => printInvoice()}
            >
              <Printer />
              <span> Printa</span>
            </button>
            <button
              className="btn btn-primary mt-2 me-1"
              onClick={() => saveInvoicePdf(line)}
            >
              <Download />
              <span> Tak niður</span>
            </button>
            {confirmDelete ? (
              <div>
                <span>
                  Skriva fakturanummarið inn og trýst síðan á "Enter" fyri at
                  sletta fakturan
                </span>
                <input
                  onKeyDown={(e) => handleKeyDown(e, line)}
                  onChange={(e) => setConfirmDeleteInput(e.target.value)}
                  className="form-control w-25 remove-inner-spin-button"
                  type="number"
                ></input>
              </div>
            ) : (
              <button
                className="btn btn-danger mt-2"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash3 />
                <span> Sletta</span>
              </button>
            )}
          </div>
        ) : (
          <div></div>
        )}
        {selectedInvoice === index && sortBy === "paid" ? (
          <div>
            <button
              className="btn btn-danger  me-1 mt-2"
              onClick={() => markAsUnpaid(line)}
              onMouseLeave={() => setMarkAsUnpaidConfirmation(0)}
            >
              {markAsUnpaidConfirmation === 0 ? (
                <>
                  <CartX />
                  <span> Ógoldið</span>
                </>
              ) : (
                <>
                  <CartX />
                  <span> Sikkur?</span>
                </>
              )}
            </button>
            <button
              className="btn btn-primary me-1 mt-2"
              onClick={() => printInvoice()}
            >
              <Printer />
              <span> Printa</span>
            </button>
            <button
              className="btn btn-primary mt-2"
              onClick={() => saveInvoicePdf(line)}
            >
              <Download />
              <span> Tak niður</span>
            </button>
          </div>
        ) : (
          <div></div>
        )}
      </div>
    ));

  return (
    <div className="screen">
      <div className="left-side">
        <nav className="navbar navbar-default navbar-expand-lg navbar-light bg-light w-100">
          <div className="container-fluid">
            <ul className="nav navbar-nav nav-pills">
              <li className="nav-item">
                <a
                  role="button"
                  className={`nav-link user-select-none ${
                    sortBy === "saved" ? " active text-white" : ""
                  }`}
                  onClick={() => setSortBy("saved")}
                >
                  Goymt
                </a>
              </li>
              <li className="nav-item">
                <a
                  role="button"
                  className={`nav-link user-select-none ${
                    sortBy === "unpaid" ? " active text-white" : ""
                  }`}
                  onClick={() => setSortBy("unpaid")}
                >
                  Ógoldið
                </a>
              </li>
              <li className="nav-item">
                <a
                  role="button"
                  className={`nav-link user-select-none ${
                    sortBy === "paid" ? " active text-white" : ""
                  }`}
                  onClick={() => setSortBy("paid")}
                >
                  Goldið
                </a>
              </li>
            </ul>
          </div>
          <input
            type="file"
            id="files"
            className="hidden"
            onChange={retrieveBackup}
          ></input>
          <label
            htmlFor="files"
            className="retrieve-backup-button text-primary me-2"
          >
            Trygdarfílur
          </label>
          <div className="search-div form-control me-2 w-25">
            <Search />
            <input
              className="search-input-invoice-manager"
              placeholder="Leita..."
              value={searchInvoice}
              onChange={(e) => {
                setSearchInvoice(e.target.value);
              }}
            ></input>
          </div>
        </nav>
        <div className="invoice-overview">{listItems}</div>
      </div>

      <div className="invoice-viewer">
        {pdf == "" ? (
          <div></div>
        ) : (
          <Worker workerUrl={pdfWorker}>
            <Viewer fileUrl={pdf} defaultScale={SpecialZoomLevel.PageFit} />
          </Worker>
        )}
      </div>
    </div>
  );
}

export default InvoiceManager;
