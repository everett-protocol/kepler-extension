import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  FeeButtons,
  CoinInput,
  Input,
  TextArea,
  DefaultGasPriceStep
} from "../../../components/form";
import { RouteComponentProps } from "react-router-dom";
import { useStore } from "../../stores";

import { HeaderLayout } from "../../layouts";
import { Button } from "../../../components/button";

import { PopupWalletProvider } from "../../wallet-provider";

import { MsgSend } from "@everett-protocol/cosmosjs/x/bank";
import {
  AccAddress,
  useBech32Config,
  useBech32ConfigPromise
} from "@everett-protocol/cosmosjs/common/address";
import { Coin } from "@everett-protocol/cosmosjs/common/coin";

import bigInteger from "big-integer";
import useForm, { FormContext } from "react-hook-form";
import { observer } from "mobx-react";

import { useCosmosJS } from "../../../hooks";
import { TxBuilderConfig } from "@everett-protocol/cosmosjs/core/txBuilder";
import {
  getCurrencies,
  getCurrency,
  getCurrencyFromDenom
} from "../../../../common/currency";

import style from "./style.module.scss";
import { CoinUtils } from "../../../../common/coin-utils";
import { Dec } from "@everett-protocol/cosmosjs/common/decimal";
import { useNotification } from "../../../components/notification";
import { Int } from "@everett-protocol/cosmosjs/common/int";

import { useIntl } from "react-intl";

interface FormData {
  recipient: string;
  amount: string;
  denom: string;
  memo: string;
  fee: Coin | undefined;
}

export const SendPage: FunctionComponent<RouteComponentProps> = observer(
  ({ history }) => {
    const intl = useIntl();

    const formMethods = useForm<FormData>({
      defaultValues: {
        recipient: "",
        amount: "",
        denom: "",
        memo: ""
      }
    });
    const {
      register,
      handleSubmit,
      errors,
      setValue,
      watch,
      setError,
      clearError
    } = formMethods;

    register(
      { name: "fee" },
      {
        required: intl.formatMessage({
          id: "send.input.fee.error.required"
        })
      }
    );

    const notification = useNotification();

    const { chainStore, accountStore, priceStore } = useStore();
    const [walletProvider] = useState(
      new PopupWalletProvider(undefined, {
        onRequestSignature: (index: string) => {
          history.push(`/sign/${index}`);
        }
      })
    );
    const cosmosJS = useCosmosJS(chainStore.chainInfo, walletProvider, {
      useBackgroundTx: true
    });

    const [gasForSendMsg] = useState(60000);

    const feeCurrency = useMemo(() => {
      return getCurrency(chainStore.chainInfo.feeCurrencies[0]);
    }, [chainStore.chainInfo.feeCurrencies]);

    const feePrice = priceStore.getValue("usd", feeCurrency?.coinGeckoId);

    const feeValue = useMemo(() => {
      return feePrice ? feePrice.value : new Dec(0);
    }, [feePrice]);

    const [allBalance, setAllBalance] = useState(false);

    const onChangeAllBalance = useCallback((allBalance: boolean) => {
      setAllBalance(allBalance);
    }, []);

    const fee = watch("fee");
    const amount = watch("amount");
    const denom = watch("denom");

    useEffect(() => {
      if (allBalance) {
        setValue("amount", "");

        const currency = getCurrencyFromDenom(denom);
        if (fee && denom && currency) {
          let allAmount = new Int(0);
          for (const balacne of accountStore.assets) {
            if (balacne.denom === currency.coinMinimalDenom) {
              allAmount = balacne.amount;
              break;
            }
          }

          if (allAmount.gte(fee.amount)) {
            allAmount = allAmount.sub(fee.amount);

            const dec = new Dec(allAmount);
            let precision = new Dec(1);
            for (let i = 0; i < currency.coinDecimals; i++) {
              precision = precision.mul(new Dec(10));
            }

            setValue(
              "amount",
              dec.quoTruncate(precision).toString(currency.coinDecimals)
            );
          }
        }
      }
    }, [fee, accountStore.assets, allBalance, setValue, denom]);

    useEffect(() => {
      const feeAmount = fee ? fee.amount : new Int(0);
      const currency = getCurrencyFromDenom(denom);
      try {
        if (currency && amount) {
          let find = false;
          for (const balacne of accountStore.assets) {
            if (balacne.denom === currency.coinMinimalDenom) {
              let precision = new Dec(1);
              for (let i = 0; i < currency.coinDecimals; i++) {
                precision = precision.mul(new Dec(10));
              }

              const amountInt = new Dec(amount).mul(precision).truncate();
              if (amountInt.add(feeAmount).gt(balacne.amount)) {
                setError(
                  "amount",
                  "not-enough-fund",
                  intl.formatMessage({
                    id: "send.input.amount.error.insufficient"
                  })
                );
              } else {
                clearError("amount");
              }
              find = true;
              break;
            }
          }

          if (!find) {
            setError(
              "amount",
              "not-enough-fund",
              intl.formatMessage({
                id: "send.input.amount.error.insufficient"
              })
            );
          }
        } else {
          clearError("amount");
        }
      } catch {
        clearError("amount");
      }
    }, [accountStore.assets, amount, clearError, denom, fee, intl, setError]);

    return (
      <HeaderLayout
        showChainName
        canChangeChainInfo={false}
        onBackButton={() => {
          history.goBack();
        }}
      >
        <form
          className={style.formContainer}
          onSubmit={e => {
            // React form hook doesn't block submitting when error is delivered outside.
            // So, jsut check if errors exists manually, and if it exists, do nothing.
            if (errors.amount && errors.amount.message) {
              e.preventDefault();
              return;
            }
            handleSubmit(async (data: FormData) => {
              const coin = CoinUtils.getCoinFromDecimals(
                data.amount,
                data.denom
              );

              await useBech32ConfigPromise(
                chainStore.chainInfo.bech32Config,
                async () => {
                  const msg = new MsgSend(
                    AccAddress.fromBech32(accountStore.bech32Address),
                    AccAddress.fromBech32(data.recipient),
                    [coin]
                  );

                  const config: TxBuilderConfig = {
                    gas: bigInteger(gasForSendMsg),
                    memo: data.memo,
                    fee: data.fee as Coin
                  };

                  if (cosmosJS.sendMsgs) {
                    await cosmosJS.sendMsgs(
                      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                      [msg!],
                      config,
                      () => {
                        history.replace("/");
                      },
                      e => {
                        history.replace("/");
                        notification.push({
                          type: "danger",
                          content: e.toString(),
                          duration: 5,
                          canDelete: true,
                          placement: "top-center",
                          transition: {
                            duration: 0.25
                          }
                        });
                      },
                      "commit"
                    );
                  }
                }
              );
            })(e);
          }}
        >
          <div className={style.formInnerContainer}>
            <div>
              <Input
                type="text"
                label={intl.formatMessage({ id: "send.input.recipient" })}
                name="recipient"
                error={errors.recipient && errors.recipient.message}
                ref={register({
                  required: intl.formatMessage({
                    id: "send.input.recipient.error.required"
                  }),
                  validate: (value: string) => {
                    // This is not react hook.
                    // eslint-disable-next-line react-hooks/rules-of-hooks
                    return useBech32Config(
                      chainStore.chainInfo.bech32Config,
                      () => {
                        try {
                          AccAddress.fromBech32(value);
                        } catch (e) {
                          return intl.formatMessage({
                            id: "send.input.recipient.error.invalid"
                          });
                        }
                      }
                    );
                  }
                })}
              />
              <CoinInput
                currencies={getCurrencies(chainStore.chainInfo.currencies)}
                label={intl.formatMessage({ id: "send.input.amount" })}
                balances={accountStore.assets}
                balanceText={intl.formatMessage({
                  id: "send.input-button.balance"
                })}
                onChangeAllBanace={onChangeAllBalance}
                error={
                  (errors.amount && errors.amount.message) ||
                  (errors.denom && errors.denom.message)
                }
                input={{
                  name: "amount",
                  ref: register({
                    required: intl.formatMessage({
                      id: "send.input.amount.error.required"
                    }),
                    validate: () => {
                      // Without this, react-form-hooks clears the errors added manually when validating.
                      // So, re-validation per onChange will clear the errors related to amount.
                      // To avoid this problem, jsut return the previous error when validating.
                      // This is not good solution.
                      // TODO: Make the process that checks that a user has enough assets be better.
                      return errors?.amount?.message;
                    }
                  })
                }}
                select={{
                  name: "denom",
                  ref: register({
                    required: intl.formatMessage({
                      id: "send.input.amount.error.required"
                    })
                  })
                }}
              />
              <TextArea
                label={intl.formatMessage({ id: "send.input.memo" })}
                name="memo"
                rows={2}
                style={{ resize: "none" }}
                error={errors.memo && errors.memo.message}
                ref={register({ required: false })}
              />
              <FormContext {...formMethods}>
                <FeeButtons
                  label={intl.formatMessage({ id: "send.input.fee" })}
                  feeSelectLabels={{
                    low: intl.formatMessage({ id: "fee-buttons.select.low" }),
                    average: intl.formatMessage({
                      id: "fee-buttons.select.average"
                    }),
                    high: intl.formatMessage({ id: "fee-buttons.select.high" })
                  }}
                  name="fee"
                  error={errors.fee && errors.fee.message}
                  currency={feeCurrency!}
                  price={feeValue}
                  gasPriceStep={DefaultGasPriceStep}
                  gas={gasForSendMsg}
                />
              </FormContext>
            </div>
            <div style={{ flex: 1 }} />
            <Button
              type="submit"
              color="primary"
              size="medium"
              fullwidth
              loading={cosmosJS.loading}
              disabled={cosmosJS.sendMsgs == null}
            >
              {intl.formatMessage({
                id: "send.button.send"
              })}
            </Button>
          </div>
        </form>
      </HeaderLayout>
    );
  }
);
