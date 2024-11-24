'use client';

import React, {
  FC,
  Fragment,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@gitroom/react/form/button';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useHideTopEditor } from '@gitroom/frontend/components/launches/helpers/use.hide.top.editor';
import { useValues } from '@gitroom/frontend/components/launches/helpers/use.values';
import { FormProvider } from 'react-hook-form';
import { useMoveToIntegrationListener } from '@gitroom/frontend/components/launches/helpers/use.move.to.integration';
import { useExistingData } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import {
  IntegrationContext,
  useIntegration,
} from '@gitroom/frontend/components/launches/helpers/use.integration';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { postSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { UpDownArrow } from '@gitroom/frontend/components/launches/up.down.arrow';
import { arrayMoveImmutable } from 'array-move';
import { linkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { Editor } from '@gitroom/frontend/components/launches/editor';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import { AddPostButton } from '@gitroom/frontend/components/launches/add.post.button';
import { GeneralPreviewComponent } from '@gitroom/frontend/components/launches/general.preview.component';
import { capitalize } from 'lodash';
import { useToaster } from '@gitroom/react/toaster/toaster';

// Simple component to change back to settings on after changing tab
export const SetTab: FC<{ changeTab: () => void }> = (props) => {
  useEffect(() => {
    return () => {
      setTimeout(() => {
        props.changeTab();
      }, 500);
    };
  }, []);
  return null;
};

// This is a simple function that if we edit in place, we hide the editor on top
export const EditorWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const showHide = useHideTopEditor();
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    setShowEditor(true);
    showHide.hide();
    return () => {
      showHide.show();
      setShowEditor(false);
    };
  }, []);

  if (!showEditor) {
    return null;
  }

  return children;
};

export const withProvider = (
  SettingsComponent: FC<{values?: any}> | null,
  CustomPreviewComponent?: FC<{maximumCharacters?: number}>,
  dto?: any,
  checkValidity?: (
    value: Array<Array<{ path: string }>>
  ) => Promise<string | true>,
  maximumCharacters?: number
) => {
  return (props: {
    identifier: string;
    id: string;
    value: Array<{
      content: string;
      id?: string;
      image?: Array<{ path: string; id: string }>;
    }>;
    hideMenu?: boolean;
    show: boolean;
  }) => {
    const toast = useToaster();
    const existingData = useExistingData();
    const { integration, date } = useIntegration();
    useCopilotReadable({
      description:
        integration?.type === 'social'
          ? 'force content always in MD format'
          : 'force content always to be fit to social media',
      value: '',
    });
    const [editInPlace, setEditInPlace] = useState(!!existingData.integration);
    const [InPlaceValue, setInPlaceValue] = useState<
      Array<{
        id?: string;
        content: string;
        image?: Array<{ id: string; path: string }>;
      }>
    >(
      // @ts-ignore
      existingData.integration
        ? existingData.posts.map((p) => ({
            id: p.id,
            content: p.content,
            image: p.image,
          }))
        : [{ content: '' }]
    );

    const [showTab, setShowTab] = useState(0);

    const Component = useMemo(() => {
      return SettingsComponent ? SettingsComponent : () => <></>;
    }, [SettingsComponent]);

    // in case there is an error on submit, we change to the settings tab for the specific provider
    useMoveToIntegrationListener(
      [props.id],
      true,
      ({ identifier, toPreview }) => {
        if (identifier === props.id) {
          setShowTab(toPreview ? 1 : 2);
        }
      }
    );

    // this is a smart function, it updates the global value without updating the states (too heavy) and set the settings validation
    const form = useValues(
      existingData.settings,
      props.id,
      props.identifier,
      editInPlace ? InPlaceValue : props.value,
      dto,
      checkValidity,
      maximumCharacters
    );

    // change editor value
    const changeValue = useCallback(
      (index: number) => (newValue: string) => {
        return setInPlaceValue((prev) => {
          prev[index].content = newValue;
          return [...prev];
        });
      },
      [InPlaceValue]
    );

    const changeImage = useCallback(
      (index: number) =>
        (newValue: {
          target: { name: string; value?: Array<{ id: string; path: string }> };
        }) => {
          return setInPlaceValue((prev) => {
            prev[index].image = newValue.target.value;
            return [...prev];
          });
        },
      [InPlaceValue]
    );

    // add another local editor
    const addValue = useCallback(
      (index: number) => () => {
        setInPlaceValue((prev) => {
          return prev.reduce((acc, p, i) => {
            acc.push(p);
            if (i === index) {
              acc.push({ content: '' });
            }

            return acc;
          }, [] as Array<{ content: string }>);
        });
      },
      []
    );

    const changePosition = useCallback(
      (index: number) => (type: 'up' | 'down') => {
        if (type === 'up' && index !== 0) {
          setInPlaceValue((prev) => {
            return arrayMoveImmutable(prev, index, index - 1);
          });
        } else if (type === 'down') {
          setInPlaceValue((prev) => {
            return arrayMoveImmutable(prev, index, index + 1);
          });
        }
      },
      []
    );

    // Delete post
    const deletePost = useCallback(
      (index: number) => async () => {
        if (
          !(await deleteDialog(
            'Are you sure you want to delete this post?',
            'Yes, delete it!'
          ))
        ) {
          return;
        }
        setInPlaceValue((prev) => {
          prev.splice(index, 1);
          return [...prev];
        });
      },
      [InPlaceValue]
    );

    // Share Post
    const handleShare = () => {
      const postId = existingData.posts[0].id;
      const origin = window.location.origin;
      const previewPath = `${origin}/preview/${postId}`;

      try {
        navigator.clipboard.writeText(previewPath);
        return toast.show('Link copied to clipboard.', 'success');
      } catch (err) {
        toast.show('Failed to copy the link.', 'warning');
      }
    };

    // This is a function if we want to switch from the global editor to edit in place
    const changeToEditor = useCallback(async () => {
      if (
        !(await deleteDialog(
          !editInPlace
            ? 'Are you sure you want to edit only this?'
            : 'Are you sure you want to revert it back to global editing?',
          'Yes, edit in place!'
        ))
      ) {
        return false;
      }

      setEditInPlace(!editInPlace);
      setInPlaceValue(
        editInPlace
          ? [{ content: '' }]
          : props.value.map((p) => ({
              id: p.id,
              content: p.content,
              image: p.image,
            }))
      );
    }, [props.value, editInPlace]);

    useCopilotAction({
      name: editInPlace
        ? 'switchToGlobalEdit'
        : `editInPlace_${integration?.identifier}`,
      description: editInPlace
        ? 'Switch to global editing'
        : `Edit only ${integration?.identifier} this, if you want a different identifier, you have to use setSelectedIntegration first`,
      handler: async () => {
        await changeToEditor();
      },
    });

    // this is a trick to prevent the data from being deleted, yet we don't render the elements
    if (!props.show) {
      return null;
    }

    return (
      <FormProvider {...form}>
        <SetTab changeTab={() => setShowTab(0)} />
        <div className="mt-[15px] w-full flex flex-col flex-1">
          {!props.hideMenu && (
            <div className="flex gap-[4px]">
              <div className="flex flex-1">
                <Button
                  className="rounded-[4px] flex-1 overflow-hidden whitespace-nowrap"
                  secondary={showTab !== 0}
                  onClick={() => setShowTab(0)}
                >
                  Preview
                </Button>
              </div>
              {!!SettingsComponent && (
                <div className="flex flex-1">
                  <Button
                    className={clsx(
                      'flex-1 overflow-hidden whitespace-nowrap',
                      showTab === 2 && 'rounded-[4px]'
                    )}
                    secondary={showTab !== 2}
                    onClick={() => setShowTab(2)}
                  >
                    Settings
                  </Button>
                </div>
              )}
              <div className="flex flex-1">
                <Button
                  className="text-white rounded-[4px] flex-1 !bg-red-700 overflow-hidden whitespace-nowrap"
                  secondary={showTab !== 1}
                  onClick={changeToEditor}
                >
                  {editInPlace
                    ? 'Edit globally'
                    : `Edit only ${integration?.name} (${capitalize(
                        integration?.identifier.replace('-', ' ')
                      )})`}
                </Button>
              </div>
            </div>
          )}
          {editInPlace &&
            createPortal(
              <EditorWrapper>
                <div className="flex flex-col gap-[20px]">
                  {!existingData?.integration && (
                    <div className="bg-red-800">
                      You are now editing only {integration?.name} (
                      {capitalize(integration?.identifier.replace('-', ' '))})
                    </div>
                  )}
                  {InPlaceValue.map((val, index) => (
                    <Fragment key={`edit_inner_${index}`}>
                      <div>
                        <div className="flex gap-[4px]">
                          <div className="flex-1 text-textColor editor">
                            <Editor
                              order={index}
                              height={InPlaceValue.length > 1 ? 200 : 250}
                              value={val.content}
                              commands={[
                                // ...commands
                                //   .getCommands()
                                //   .filter((f) => f.name !== 'image'),
                                // newImage,
                                postSelector(date),
                                ...linkedinCompany(
                                  integration?.identifier!,
                                  integration?.id!
                                ),
                              ]}
                              preview="edit"
                              // @ts-ignore
                              onChange={changeValue(index)}
                            />
                            {(!val.content || val.content.length < 6) && (
                              <div className="my-[5px] text-customColor19 text-[12px] font-[500]">
                                The post should be at least 6 characters long
                              </div>
                            )}
                            <div className="flex">
                              <div className="flex-1">
                                <MultiMediaComponent
                                  label="Attachments"
                                  description=""
                                  name="image"
                                  value={val.image}
                                  onChange={changeImage(index)}
                                />
                              </div>
                              <div className="flex bg-customColor20 rounded-br-[8px] text-customColor19">
                                {InPlaceValue.length > 1 && (
                                  <div
                                    className="flex cursor-pointer gap-[4px] justify-center items-center flex-1"
                                    onClick={deletePost(index)}
                                  >
                                    <div>
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 14 14"
                                        fill="currentColor"
                                      >
                                        <path
                                          d="M11.8125 2.625H9.625V2.1875C9.625 1.8394 9.48672 1.50556 9.24058 1.25942C8.99444 1.01328 8.6606 0.875 8.3125 0.875H5.6875C5.3394 0.875 5.00556 1.01328 4.75942 1.25942C4.51328 1.50556 4.375 1.8394 4.375 2.1875V2.625H2.1875C2.07147 2.625 1.96019 2.67109 1.87814 2.75314C1.79609 2.83519 1.75 2.94647 1.75 3.0625C1.75 3.17853 1.79609 3.28981 1.87814 3.37186C1.96019 3.45391 2.07147 3.5 2.1875 3.5H2.625V11.375C2.625 11.6071 2.71719 11.8296 2.88128 11.9937C3.04538 12.1578 3.26794 12.25 3.5 12.25H10.5C10.7321 12.25 10.9546 12.1578 11.1187 11.9937C11.2828 11.8296 11.375 11.6071 11.375 11.375V3.5H11.8125C11.9285 3.5 12.0398 3.45391 12.1219 3.37186C12.2039 3.28981 12.25 3.17853 12.25 3.0625C12.25 2.94647 12.2039 2.83519 12.1219 2.75314C12.0398 2.67109 11.9285 2.625 11.8125 2.625ZM5.25 2.1875C5.25 2.07147 5.29609 1.96019 5.37814 1.87814C5.46019 1.79609 5.57147 1.75 5.6875 1.75H8.3125C8.42853 1.75 8.53981 1.79609 8.62186 1.87814C8.70391 1.96019 8.75 2.07147 8.75 2.1875V2.625H5.25V2.1875ZM10.5 11.375H3.5V3.5H10.5V11.375ZM6.125 5.6875V9.1875C6.125 9.30353 6.07891 9.41481 5.99686 9.49686C5.91481 9.57891 5.80353 9.625 5.6875 9.625C5.57147 9.625 5.46019 9.57891 5.37814 9.49686C5.29609 9.41481 5.25 9.30353 5.25 9.1875V5.6875C5.25 5.57147 5.29609 5.46019 5.37814 5.37814C5.46019 5.29609 5.57147 5.25 5.6875 5.25C5.80353 5.25 5.91481 5.29609 5.99686 5.37814C6.07891 5.46019 6.125 5.57147 6.125 5.6875ZM8.75 5.6875V9.1875C8.75 9.30353 8.70391 9.41481 8.62186 9.49686C8.53981 9.57891 8.42853 9.625 8.3125 9.625C8.19647 9.625 8.08519 9.57891 8.00314 9.49686C7.92109 9.41481 7.875 9.30353 7.875 9.1875V5.6875C7.875 5.57147 7.92109 5.46019 8.00314 5.37814C8.08519 5.29609 8.19647 5.25 8.3125 5.25C8.42853 5.25 8.53981 5.29609 8.62186 5.37814C8.70391 5.46019 8.75 5.57147 8.75 5.6875Z"
                                          fill="#F97066"
                                        />
                                      </svg>
                                    </div>
                                    <div className="text-[12px] font-[500] pr-[10px]">
                                      Delete Post
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div>
                            <UpDownArrow
                              isUp={index !== 0}
                              isDown={
                                InPlaceValue.length !== 0 &&
                                InPlaceValue.length !== index + 1
                              }
                              onChange={changePosition(index)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-[8px] items-center">
                        <AddPostButton onClick={addValue(index)} num={index} />
                        <Button
                          onClick={handleShare}
                          className="!h-[24px] rounded-[3px] flex gap-[4px] w-[102px] text-[12px] font-[500]"
                        >
                          <div>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              version="1.1"
                              x="0px"
                              y="0px"
                              viewBox="0 0 800 1000"
                              className="max-w-[20px] max-h-[20px] fill-current h-[1.25em]"
                            >
                              <path
                                fill="white"
                                d="M443.25,529.42c2.9,1.32,6.32,0.83,8.73-1.27l211.28-183.37c1.79-1.55,2.81-3.79,2.81-6.16c0-2.37-1.02-4.61-2.81-6.16  L451.98,149.11c-2.41-2.1-5.83-2.59-8.73-1.27c-2.91,1.33-4.77,4.23-4.77,7.42v109.52c-168.67,5.27-304.54,173.69-304.54,379.94  c0,3.81,2.63,7.11,6.35,7.95c0.61,0.14,1.21,0.21,1.81,0.21c3.08,0,5.97-1.75,7.35-4.63c81.79-170.48,158.11-233.12,289.03-235.58  V522C438.47,525.19,440.34,528.09,443.25,529.42z M151.83,607.06c15.41-182.94,141.74-326.08,294.8-326.08  c4.51,0,8.16-3.65,8.16-8.16v-99.67l190.67,165.48L454.79,504.11v-99.67c0-4.51-3.65-8.16-8.16-8.16  C314.35,396.29,231.89,454.14,151.83,607.06z"
                              />
                            </svg>
                          </div>

                          <div className="text-white">Share</div>
                        </Button>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </EditorWrapper>,
              document.querySelector('#renderEditor')!
            )}
          {(showTab === 0 || showTab === 2) && (
            <div className={clsx('mt-[20px]', showTab !== 2 && 'hidden')}>
              <Component values={editInPlace ? InPlaceValue : props.value} />
            </div>
          )}
          {showTab === 0 && (
            <div className="mt-[20px] flex flex-col items-center">
              <IntegrationContext.Provider
                value={{
                  date,
                  value: editInPlace ? InPlaceValue : props.value,
                  integration,
                }}
              >
                {(editInPlace ? InPlaceValue : props.value)
                  .map((p) => p.content)
                  .join('').length ? (
                  CustomPreviewComponent ? (
                    <CustomPreviewComponent
                      maximumCharacters={maximumCharacters}
                    />
                  ) : (
                    <GeneralPreviewComponent
                      maximumCharacters={maximumCharacters}
                    />
                  )
                ) : (
                  <>No Content Yet</>
                )}
              </IntegrationContext.Provider>
            </div>
          )}
        </div>
      </FormProvider>
    );
  };
};
