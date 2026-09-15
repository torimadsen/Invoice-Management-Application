import "../invoice.css";
import logo from "../assets/logo.png";
import { useState, useEffect, useRef } from "react";
import React from "react";
import generatePDF from "../utils/generatePDF.ts";
import {
  returnCityFromPostalCode,
  returnPostalCodeFromCity,
} from "../utils/postalCodes.ts";
import {
  BaseDirectory,
  exists,
  writeTextFile,
  readTextFile,
} from "@tauri-apps/plugin-fs";
import { loginWithMicrosoft } from "../utils/loginWithMicrosof.ts";
import { printPdf } from "../utils/printPDF.ts";
import {
  Send,
  Trash3,
  PlusLg,
  FileEarmarkText,
  Search,
  PersonAdd,
  People,
  Check,
} from "react-bootstrap-icons";
import { useParams } from "react-router-dom";
import { LineItem, Customer } from "../types/invoice.ts";

function InvoiceEditor() {
  const { id } = useParams();

  const [total, setTotal] = useState(0);
  const [invoiceCreatedDate, setInvoiceCreatedDate] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceId, setInvoiceId] = useState(1000);
  const [list, setList] = useState([
    {
      tekstur: "",
      nøgd: "1",
      prísur: "",
      avsláttur: "",
      upphædd: "0.00",
    },
  ]);
  const [customer, setCustomer] = React.useState({
    fyritøka: "",
    navn: "",
    addressa: "",
    postnummar: "",
    bygd: "",
    teldupostur: "",
  });
  const [isCustomersOpen, setIsCustomersOpen] = useState(false);
  const toggleCustomersBox = () => {
    setIsCustomersOpen(!isCustomersOpen);
  };
  const [customerAddedButton, setCustomerAddedButton] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [searchCustomer, setSearchCustomer] = useState("");
  const [noEmailError, setNoEmailError] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const updateInvoiceId = async () => {
    const dataString = await readTextFile("data.json", {
      baseDir: BaseDirectory.AppData,
    });
    const DATA = JSON.parse(dataString);
    setInvoiceId(+DATA.previousInvoiceId + 1);
  };

  const updateCustomersList = async () => {
    const dataString = await readTextFile("data.json", {
      baseDir: BaseDirectory.AppData,
    });
    const DATA = JSON.parse(dataString);
    setCustomersList(DATA.customers);
  };

  useEffect(() => {
    updateInvoiceId();
    updateCustomersList();
    createDataFile();
  }, []);

  const updateInvoiceCreatedDate = () => {
    var createdDate = new Date();
    var dd = String(createdDate.getDate()).padStart(2, "0");
    var mm = String(createdDate.getMonth() + 1).padStart(2, "0"); //January is 0!
    var yyyy = createdDate.getFullYear();

    setInvoiceCreatedDate(dd + "/" + mm + "/" + yyyy);

    const daysTillDue = 14;
    var dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysTillDue);
    var dd2 = String(dueDate.getDate()).padStart(2, "0");
    var mm2 = String(dueDate.getMonth() + 1).padStart(2, "0"); //January is 0!
    var yyyy2 = dueDate.getFullYear();

    setInvoiceDueDate(dd2 + "/" + mm2 + "/" + yyyy2);
  };

  useEffect(() => {
    updateInvoiceCreatedDate();

    const interval = setInterval(() => {
      updateInvoiceCreatedDate();
    }, 60000); // updates date every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadId = async () => {
      // load edit
      if (id) {
        const dataString = await readTextFile("data.json", {
          baseDir: BaseDirectory.AppData,
        });
        const DATA = JSON.parse(dataString);
        const rokning = DATA.rokningar[id];

        console.log(rokning);

        // load
        setInvoiceId(Number(id));
        setTotal(rokning.total);
        setCustomer(rokning.customer);
        setList(rokning.list);
      } else {
        //console.log("No Id found");
      }
    };

    loadId();
  }, []);

  const updateTotal = (updated: LineItem[]) => {
    let cumulativeTotal = 0;
    console.log(updated.length);
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].upphædd === "") {
        continue;
      }
      cumulativeTotal += Number(updated[i].upphædd);
    }
    setTotal(cumulativeTotal);
  };

  const createDataFile = async () => {
    // create empty data.json file in AppData/Rokningar, if it doesn't exist
    const dataFileExists = await exists("data.json", {
      baseDir: BaseDirectory.AppData,
    });
    if (!dataFileExists) {
      const contents = JSON.stringify({
        previousInvoiceId: 1000,
        rokningar: {},
        customers: [],
      });
      await writeTextFile("data.json", contents, {
        baseDir: BaseDirectory.AppData,
      });
    }
  };

  const resetState = () => {
    setCustomer({
      fyritøka: "",
      navn: "",
      addressa: "",
      postnummar: "",
      bygd: "",
      teldupostur: "",
    });
    setList([
      {
        tekstur: "",
        nøgd: "1",
        prísur: "",
        avsláttur: "",
        upphædd: "0.00",
      },
    ]);
    setTotal(0);
    setCustomerAddedButton(false);
    setNoEmailError(false);
  };

  const saveCustomer = async () => {
    if (customerAddedButton) {
      return;
    }
    //store invoice data in data.json
    if (customer.fyritøka === "" && customer.navn === "") {
      return;
    }

    const dataString = await readTextFile("data.json", {
      baseDir: BaseDirectory.AppData,
    });
    const DATA = JSON.parse(dataString);
    DATA.customers.push(customer);

    // update data.json file
    await writeTextFile("data.json", JSON.stringify(DATA, null, 2), {
      baseDir: BaseDirectory.AppData,
    });

    updateCustomersList();
    setCustomerAddedButton(true);
  };

  const downloadPDF = async (action: string) => {
    if (action === "send" && customer.teldupostur == "") {
      setNoEmailError(true);
      emailRef.current?.focus();
      return;
    }

    updateInvoiceCreatedDate();

    const base64Data = generatePDF(
      list,
      customer,
      total,
      invoiceId,
      invoiceCreatedDate,
      invoiceDueDate,
      false,
    );

    //store invoice data in data.json
    const dataString = await readTextFile("data.json", {
      baseDir: BaseDirectory.AppData,
    });
    const DATA = JSON.parse(dataString);
    const newInvoice = {
      [invoiceId]: {
        id: invoiceId,
        createdDate: {},
        dueDate: {},
        total: {},
        status: "saved",
        customer: {},
        list: {},
      },
    };
    newInvoice[invoiceId].createdDate = invoiceCreatedDate;
    newInvoice[invoiceId].dueDate = invoiceDueDate;
    newInvoice[invoiceId].total = total;
    newInvoice[invoiceId].customer = customer;
    newInvoice[invoiceId].list = list;
    Object.assign(DATA.rokningar, newInvoice);

    //update previousInvoiceId
    if (!id) {
      // id undefined means a new invoice is being created
      DATA.previousInvoiceId = invoiceId;
    }

    console.log(DATA);

    // update data.json file
    await writeTextFile("data.json", JSON.stringify(DATA, null, 2), {
      baseDir: BaseDirectory.AppData,
    });

    if (action == "send") {
      loginWithMicrosoft(base64Data, customer.teldupostur, invoiceId);
    }

    if (action == "print") {
      await printPdf(base64Data);
    }

    //reset editor
    resetState();

    updateInvoiceId();
  };

  const handleInputChange = (
    index: number,
    newValue: string,
    field: string,
  ) => {
    setList((prev) => {
      const updated = [...prev];
      if (field == "tekstur") {
        newValue = newValue.replace("flugger", "flügger");
        newValue = newValue.replace("Flugger", "Flügger");
        newValue = newValue.replace("flúgger", "flügger");
        newValue = newValue.replace("Flúgger", "Flügger");
      }
      updated[index] = { ...updated[index], [field]: newValue };
      if (updated[index].nøgd !== "" && updated[index].prísur !== "") {
        if (updated[index].avsláttur !== "") {
          updated[index].upphædd = (
            +updated[index].nøgd *
            +updated[index].prísur *
            ((100 - +updated[index].avsláttur) / 100)
          ).toFixed(2);
        } else {
          updated[index].upphædd = (
            +updated[index].nøgd * +updated[index].prísur
          ).toFixed(2);
        }
      } else {
        updated[index].upphædd = "0.00";
      }
      updateTotal(updated);
      return updated;
    });
  };

  const handleAddLineClick = () => {
    setList((prev) => [
      ...prev,
      {
        tekstur: "",
        nøgd: "1",
        prísur: "",
        avsláttur: "",
        upphædd: "0.00",
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key == "Enter") {
      e.preventDefault();
      handleAddLineClick();
    }
  };

  const handleDeleteLineClick = (index: number) => {
    setList((prev) => {
      const updated = [...prev];
      updated.splice(index, 1);

      updateTotal(updated);

      return updated;
    });
  };

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCustomer((prev) => ({
      ...prev,
      postnummar: value,
    }));
    const city: string | undefined = returnCityFromPostalCode(Number(value));
    console.log(city);
    if (city) {
      setCustomer((prev) => ({
        ...prev,
        bygd: city,
      }));
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value =
      e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1);
    setCustomer((prev) => ({
      ...prev,
      bygd: value,
    }));
    const postalCode: string | undefined = returnPostalCodeFromCity(value);
    if (postalCode) {
      setCustomer((prev) => ({
        ...prev,
        postnummar: postalCode,
      }));
    }
  };

  const searchCustomers = (line: Customer) => {
    if (
      line.fyritøka !== "" &&
      line.fyritøka.toLowerCase().includes(searchCustomer.toLowerCase())
    ) {
      return true;
    }
    if (
      line.navn !== "" &&
      line.navn.toLowerCase().includes(searchCustomer.toLowerCase())
    ) {
      return true;
    }
    if (
      line.addressa !== "" &&
      line.addressa.toLowerCase().includes(searchCustomer.toLowerCase())
    ) {
      return true;
    }
    if (
      line.postnummar !== "" &&
      line.postnummar.toLowerCase().includes(searchCustomer.toLowerCase())
    ) {
      return true;
    }
    if (
      line.bygd !== "" &&
      line.bygd.toLowerCase().includes(searchCustomer.toLowerCase())
    ) {
      return true;
    }
    if (
      line.teldupostur !== "" &&
      line.teldupostur.toLowerCase().includes(searchCustomer.toLowerCase())
    ) {
      return true;
    }
    return false;
  };

  const loadCustomer = (line: Customer) => {
    setCustomer(line);
    setIsCustomersOpen(false);
    setSearchCustomer("");
    setCustomerAddedButton(true);
  };

  const handleDeleteUserClick = async (index: number) => {
    //store invoice data in data.json
    const dataString = await readTextFile("data.json", {
      baseDir: BaseDirectory.AppData,
    });
    const DATA = JSON.parse(dataString);
    DATA.customers.splice(index, 1);

    // update data.json file
    await writeTextFile("data.json", JSON.stringify(DATA, null, 2), {
      baseDir: BaseDirectory.AppData,
    });

    updateCustomersList();
  };

  const listCustomers = customersList
    .filter((line) => searchCustomers(line))
    .map((line: Customer, index) => (
      <div className="customer-line-div">
        <table>
          <tr>
            <td>
              <button
                className="customer-line-button form-control"
                onClick={() => loadCustomer(line)}
              >
                {line.fyritøka === "" ? line.navn : line.fyritøka}
              </button>
            </td>
            <td>
              <button
                className="btn btn-link link-danger"
                tabIndex={-1}
                onClick={() => handleDeleteUserClick(index)}
              >
                <Trash3 />
              </button>
            </td>
          </tr>
        </table>
      </div>
    ));

  const listItems = list.map((line, index) => (
    <tr className="item">
      <td>
        <div className="input-group">
          <input
            autoFocus
            value={line.tekstur}
            onChange={(e) =>
              handleInputChange(
                index,
                e.target.value.charAt(0).toUpperCase() +
                  e.target.value.slice(1),
                "tekstur",
              )
            }
            onKeyDown={handleKeyDown}
            type="text"
            className="form-control"
          />
        </div>
      </td>
      <td>
        <div className="input-group">
          <input
            value={line.nøgd}
            onChange={(e) => handleInputChange(index, e.target.value, "nøgd")}
            onKeyDown={handleKeyDown}
            type="number"
            className="form-control"
          />
        </div>
      </td>
      <td>
        <div className="input-group">
          <input
            value={line.prísur}
            onChange={(e) => handleInputChange(index, e.target.value, "prísur")}
            onKeyDown={handleKeyDown}
            type="number"
            className="form-control remove-inner-spin-button"
          />
        </div>
      </td>
      <td>
        <div className="input-group">
          <input
            value={line.avsláttur}
            onChange={(e) =>
              handleInputChange(index, e.target.value, "avsláttur")
            }
            onKeyDown={handleKeyDown}
            type="number"
            className="form-control remove-inner-spin-button"
          />
        </div>
      </td>
      <td>
        <div className="input-group">
          <input
            readOnly
            className="form-control bg-light text-muted align-middle"
            value={line.upphædd}
            tabIndex={-1}
          />
        </div>
      </td>
      <td>
        <button
          className="btn btn-link link-danger"
          onClick={() => handleDeleteLineClick(index)}
          tabIndex={-1}
        >
          <Trash3 />
        </button>
      </td>
    </tr>
  ));

  return (
    <div
      className="invoice-box"
      style={
        list.length > 10
          ? { height: 1122 + (list.length - 10) * 49 + "px" }
          : {}
      }
    >
      <tr className="top">
        <td>
          <table className="info-table">
            <tr>
              <td>
                Fakturanummar #: {invoiceId}
                <br />
                Skjaladagur: {invoiceCreatedDate}
                <br />
                Fellur tann: {invoiceDueDate}
                <br />
                Gjaldstreytir: Netto 14 dagar
              </td>

              <td className="title">
                <img src={logo} className="logo" />
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr className="information">
        <td>
          <table>
            <tr>
              <td>
                <button
                  type="button"
                  className="btn btn-primary me-1 mb-1"
                  onClick={saveCustomer}
                  tabIndex={-1}
                  disabled={customerAddedButton}
                >
                  {customerAddedButton ? <Check /> : <PersonAdd />}
                  <span> Stovna brúkara</span>
                </button>
                <button
                  type="button"
                  className="btn btn-primary mb-1"
                  onClick={toggleCustomersBox}
                >
                  <People />
                  <span> Brúkarar</span>
                </button>
                {isCustomersOpen && (
                  <div className="customers-div">
                    <div className="search-div form-control">
                      <Search />
                      <input
                        className="search-input"
                        placeholder="Leita..."
                        value={searchCustomer}
                        onChange={(e) => {
                          setSearchCustomer(e.target.value);
                        }}
                      ></input>
                    </div>
                    <div className="customers-lines-div">{listCustomers}</div>
                  </div>
                )}
                <input
                  className="form-control mb-1 mt-1"
                  placeholder="Fyritøka (valfrítt)"
                  value={customer.fyritøka}
                  onChange={(e) => {
                    setCustomer((prev) => ({
                      ...prev,
                      fyritøka:
                        e.target.value.charAt(0).toUpperCase() +
                        e.target.value.slice(1),
                    }));
                    setCustomerAddedButton(false);
                  }}
                />
                <input
                  className="form-control mb-1"
                  placeholder="Navn"
                  value={customer.navn}
                  onChange={(e) => {
                    setCustomer((prev) => ({
                      ...prev,
                      navn:
                        e.target.value.charAt(0).toUpperCase() +
                        e.target.value.slice(1),
                    }));
                    setCustomerAddedButton(false);
                  }}
                />
                <input
                  className="form-control mb-1"
                  placeholder="Addressa"
                  value={customer.addressa}
                  onChange={(e) => {
                    setCustomer((prev) => ({
                      ...prev,
                      addressa:
                        e.target.value.charAt(0).toUpperCase() +
                        e.target.value.slice(1),
                    }));
                    setCustomerAddedButton(false);
                  }}
                />
                <div className="input-group mb-1">
                  <input
                    className="form-control w-25"
                    placeholder="Postnummar"
                    value={customer.postnummar}
                    onChange={(e) => {
                      handlePostalCodeChange(e);
                      setCustomerAddedButton(false);
                    }}
                  />
                  <input
                    className="form-control w-75"
                    placeholder="Býur/Bygd"
                    value={customer.bygd}
                    onChange={(e) => {
                      handleCityChange(e);
                      setCustomerAddedButton(false);
                    }}
                  />
                </div>
                <input
                  className={
                    noEmailError
                      ? "form-control mb-1 noEmailError"
                      : "form-control mb-1"
                  }
                  ref={emailRef}
                  placeholder="Teldupostur"
                  value={customer.teldupostur}
                  onChange={(e) => {
                    setCustomer((prev) => ({
                      ...prev,
                      teldupostur: e.target.value,
                    }));
                    setCustomerAddedButton(false);
                  }}
                />
              </td>

              <td className="sender-info">
                <div>
                  Company Name
                  <br />
                  Address
                  <br />
                  999 City
                  <br />
                  example@example.com
                  <br />
                  tel +298 123456
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <table>
        <tr className="heading">
          <td>Tekstur</td>
          <td>Nøgd</td>
          <td>Prísur</td>
          <td>Avsláttur</td>
          <td>Upphædd</td>
        </tr>

        {listItems}

        <tr>
          <button
            type="button"
            className="btn btn-primary m-1"
            onClick={handleAddLineClick}
          >
            <PlusLg />
            <span> Nýggj regla</span>
          </button>
        </tr>
      </table>
      <div className="total-div">
        <div className="total">
          <span className="tilsamans">Tilsamans: {total?.toFixed(2)} kr</span>
          <span className="mvg">
            Harav MVG:
            {(total * 0.2)?.toFixed(2)} kr
          </span>
        </div>
      </div>

      <button
        className="btn btn-primary me-1"
        onClick={() => downloadPDF("save")}
        tabIndex={-1}
      >
        <FileEarmarkText />
        <span> Goym</span>
      </button>
      <button
        tabIndex={-1}
        className="btn btn-success"
        onClick={() => downloadPDF("send")}
      >
        <Send />
        <span> Send</span>
      </button>
      {/* <button className="btn btn-success" onClick={(e) => downloadPDF("print")}>
        <Printer />
        <span> Print</span>
      </button>*/}
    </div>
  );
}

export default InvoiceEditor;
